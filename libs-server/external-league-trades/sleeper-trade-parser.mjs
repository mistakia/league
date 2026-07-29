// Pure parsing of Sleeper league + transaction payloads into the
// external_leagues / external_league_trades / external_league_trade_legs shape.
//
// Deliberately free of network and database access so the payload logic -- the
// part that breaks when a vendor changes a field -- is testable from fixtures
// alone. The importer supplies the IO.

// Sleeper settings.type. 2 is dynasty, 1 keeper, 0 redraft.
const SLEEPER_LEAGUE_TYPE = {
  0: 'redraft',
  1: 'keeper',
  2: 'dynasty'
}

// A league is superflex if it has an explicit SUPER_FLEX slot, or enough
// dedicated QB slots that a second starting QB is possible. Both spellings
// matter: the effect on QB value is the same either way, and a check for only
// the SUPER_FLEX literal would misclassify 2QB leagues as single-QB, which is
// exactly the misread that makes a QB trade uncomparable.
export const derive_is_superflex = (roster_positions) => {
  if (!Array.isArray(roster_positions)) {
    return false
  }

  if (roster_positions.includes('SUPER_FLEX')) {
    return true
  }

  return roster_positions.filter((slot) => slot === 'QB').length >= 2
}

/**
 * Map a Sleeper league payload to an external_leagues row.
 * @param {Object} params
 * @param {Object} params.league - Raw Sleeper /league/{id} payload
 * @param {string} [params.discovered_via] - How the crawler reached this league
 * @returns {Object|null} Row, or null when the payload is unusable
 */
export const parse_sleeper_league = ({ league, discovered_via = null }) => {
  if (!league || !league.league_id) {
    return null
  }

  // An unknown settings.type is returned as null rather than guessed. Dynasty
  // and redraft price the same player completely differently, so a wrong guess
  // silently poisons the fit -- dropping the league is the cheaper error.
  const league_format = SLEEPER_LEAGUE_TYPE[league.settings?.type]
  if (!league_format) {
    return null
  }

  const scoring_settings = league.scoring_settings || {}
  const roster_positions = league.roster_positions || []

  // Sleeper expresses tight end premium as bonus points per TE reception, on
  // top of the league-wide `rec`, so it is only meaningful as a delta.
  const tight_end_premium =
    scoring_settings.bonus_rec_te == null
      ? null
      : Number(scoring_settings.bonus_rec_te)

  return {
    platform: 'sleeper',
    external_league_id: String(league.league_id),
    season_year: Number(league.season),
    league_name: league.name || null,
    num_teams: league.total_rosters ?? league.settings?.num_teams ?? null,
    league_format,
    is_superflex: derive_is_superflex(roster_positions),
    is_best_ball: Boolean(league.settings?.best_ball),
    points_per_reception:
      scoring_settings.rec == null ? null : Number(scoring_settings.rec),
    tight_end_premium,
    passing_touchdown_points:
      scoring_settings.pass_td == null
        ? null
        : Number(scoring_settings.pass_td),
    taxi_slots: league.settings?.taxi_slots ?? null,
    roster_positions: JSON.stringify(roster_positions),
    scoring_settings: JSON.stringify(scoring_settings),
    previous_external_league_id: league.previous_league_id
      ? String(league.previous_league_id)
      : null,
    discovered_via
  }
}

/**
 * Map one Sleeper transaction to a trade row plus its legs.
 *
 * Sleeper encodes a trade as `adds` and `drops` maps of
 * player_id -> roster_id, plus a `draft_picks` array and a `waiver_budget`
 * array. `adds` names the RECEIVING roster and `drops` the SENDING roster for
 * the same player, so the two maps together give both directions.
 *
 * @param {Object} params
 * @param {Object} params.transaction - Raw Sleeper transaction payload
 * @param {string} params.external_league_id
 * @param {number} params.season_year
 * @param {number} params.platform_transaction_bucket
 * @returns {Object|null} { trade, legs }, or null when not a completed trade
 */
export const parse_sleeper_trade = ({
  transaction,
  external_league_id,
  season_year,
  platform_transaction_bucket
}) => {
  if (!transaction || transaction.type !== 'trade') {
    return null
  }

  // Vetoed and still-pending trades are not realized exchanges and carry no
  // indifference constraint, so they are not evidence.
  if (transaction.status !== 'complete') {
    return null
  }

  if (!transaction.transaction_id) {
    return null
  }

  const legs = []
  const adds = transaction.adds || {}
  const drops = transaction.drops || {}

  // Players. `adds` is authoritative for the receiving side; the matching
  // `drops` entry gives the sender. A player appearing only in `drops` within a
  // trade is a plain release rather than an exchanged asset, so it is not a leg.
  for (const [external_player_id, to_roster_id] of Object.entries(adds)) {
    legs.push({
      leg_type: 'player',
      from_roster_id: drops[external_player_id] ?? null,
      to_roster_id,
      external_player_id: String(external_player_id),
      pid: null,
      pick_season_year: null,
      pick_round: null,
      pick_original_roster_id: null,
      faab_amount: null
    })
  }

  // Draft picks. These dominate dynasty trades, and `roster_id` here is the
  // roster the pick ORIGINALLY belonged to -- distinct from owner_id (receiver)
  // and previous_owner_id (sender). Conflating those three is the classic way
  // to mis-attribute a pick, so each is mapped explicitly.
  for (const pick of transaction.draft_picks || []) {
    legs.push({
      leg_type: 'pick',
      from_roster_id: pick.previous_owner_id ?? null,
      to_roster_id: pick.owner_id,
      external_player_id: null,
      pid: null,
      pick_season_year: Number(pick.season),
      pick_round: pick.round,
      pick_original_roster_id: pick.roster_id ?? null,
      faab_amount: null
    })
  }

  // FAAB. Sleeper reports these as {sender, receiver, amount}.
  for (const budget of transaction.waiver_budget || []) {
    legs.push({
      leg_type: 'faab',
      from_roster_id: budget.sender ?? null,
      to_roster_id: budget.receiver,
      external_player_id: null,
      pid: null,
      pick_season_year: null,
      pick_round: null,
      pick_original_roster_id: null,
      faab_amount: budget.amount
    })
  }

  // A trade with nothing on one side, or nothing at all, yields no usable
  // constraint. Dropping it here keeps degenerate rows out of the fit.
  if (!legs.length) {
    return null
  }

  const receiving_rosters = new Set(legs.map((leg) => leg.to_roster_id))
  if (receiving_rosters.size < 2) {
    return null
  }

  const trade = {
    platform: 'sleeper',
    external_transaction_id: String(transaction.transaction_id),
    external_league_id: String(external_league_id),
    season_year,
    platform_transaction_bucket,
    processed_at: new Date(transaction.created),
    num_sides: (transaction.roster_ids || []).length || receiving_rosters.size
  }

  return {
    trade,
    legs: legs.map((leg, leg_index) => ({
      platform: 'sleeper',
      external_transaction_id: trade.external_transaction_id,
      leg_index,
      ...leg
    }))
  }
}

/**
 * Parse a full Sleeper transactions payload, keeping only completed trades.
 * @returns {Array<Object>} Array of { trade, legs }
 */
export const parse_sleeper_transactions = ({
  transactions,
  external_league_id,
  season_year,
  platform_transaction_bucket
}) =>
  (transactions || [])
    .map((transaction) =>
      parse_sleeper_trade({
        transaction,
        external_league_id,
        season_year,
        platform_transaction_bucket
      })
    )
    .filter(Boolean)
