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
// Sleeper uses null, the empty string, and the STRING "0" interchangeably to
// mean "no such entity", so a bare truthiness test is not enough to tell a real
// id from an absence -- `"0"` is truthy and would be followed as a real id.
// This applies to user ids as well as league ids: a league member list can
// carry an entry with no usable user_id, and inserting it would create a graph
// node that can never be expanded.
export const is_sleeper_identifier = (value) =>
  value !== null &&
  value !== undefined &&
  String(value) !== '0' &&
  String(value) !== ''

const is_league_id = is_sleeper_identifier

// Sleeper files transactions in per-week buckets numbered 1..18 within a
// league-season.
export const SLEEPER_MAX_TRANSACTION_BUCKET = 18

/**
 * Which transaction buckets are worth fetching for one league-season.
 *
 * A league-season that has not finished cannot have transactions filed under
 * weeks that have not happened, so fetching all 18 buckets for a current-season
 * league spends 17 requests to be told "no" 17 times. Measured on the live
 * corpus 2026-07-29: every one of the 3,000 trades in 2026 leagues sat in
 * bucket 1, while 2025 leagues -- a completed season -- spread across buckets 1
 * through 17. At corpus scale that was 4,233 wasted requests and it grows
 * linearly with the crawl.
 *
 * Bucket 1 is ALWAYS fetched. It carries the entire offseason on top of week 1,
 * which is where most dynasty trading happens, so it is never the bucket to
 * economise on.
 *
 * The bound carries one bucket of margin past the current week. Our week
 * boundary and Sleeper's need not roll at the same instant, and one spare
 * request is a much cheaper error than silently missing the newest trades of
 * the week -- which would be invisible, since a bucket that does not exist and
 * a bucket we declined to ask for look identical afterwards.
 *
 * @param {Object} params
 * @param {number} params.league_season_year - The league-season being imported
 * @param {number} params.current_season_year
 * @param {number} params.current_season_week - Continuous counter from
 *   regular_season_start; 0 in the offseason and preseason
 * @returns {Array<number>} Bucket numbers to fetch, ascending from 1
 */
export const sleeper_transaction_buckets_to_fetch = ({
  league_season_year,
  current_season_year,
  current_season_week
}) => {
  // A completed season is closed: every bucket that will ever hold a trade
  // already does, so all of them are worth reading.
  const is_complete = league_season_year < current_season_year

  const max_bucket = is_complete
    ? SLEEPER_MAX_TRANSACTION_BUCKET
    : Math.min(
        SLEEPER_MAX_TRANSACTION_BUCKET,
        Math.max(1, (current_season_week || 0) + 1)
      )

  return Array.from({ length: max_bucket }, (_, index) => index + 1)
}

// Sleeper's individual-defensive-player roster slots, both the grouped forms
// and the specific positions. A league starting any of these trades defenders.
const INDIVIDUAL_DEFENSIVE_PLAYER_SLOTS = new Set([
  'DL',
  'LB',
  'DB',
  'DE',
  'DT',
  'CB',
  'SS',
  'FS',
  'IDP_FLEX'
])

/**
 * Does this league start individual defensive players?
 *
 * Worth promoting to a column because it is an EXCLUSION criterion for the
 * fit, not a curiosity. Individual defenders (DT, DB, LB) are largely absent
 * from our player table, so their legs land unresolved -- and an unresolved leg
 * is not merely missing, it is BIASED: a side whose received bundle is missing
 * a player looks cheaper than it actually was, and that error is one-directional
 * so it does not average out across trades.
 */
export const derive_has_individual_defensive_players = (roster_positions) => {
  if (!Array.isArray(roster_positions)) {
    return false
  }

  return roster_positions.some((slot) =>
    INDIVIDUAL_DEFENSIVE_PLAYER_SLOTS.has(slot)
  )
}

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
    number_teams: league.total_rosters ?? league.settings?.number_teams ?? null,
    league_format,
    is_superflex: derive_is_superflex(roster_positions),
    has_individual_defensive_players:
      derive_has_individual_defensive_players(roster_positions),
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
    // Everything from here down arrives in a payload the crawl already fetches
    // and used to discard. Storing it costs no extra request; NOT storing it
    // costs a full re-crawl the next time a selection question needs it.
    league_status: league.status || null,
    external_draft_id: is_sleeper_identifier(league.draft_id)
      ? String(league.draft_id)
      : null,
    // Epoch MILLISECONDS, not seconds -- a Date built from the raw number as
    // seconds lands in 1970. Converted here so no read site has to know the unit.
    last_message_at: league.last_message_time
      ? new Date(Number(league.last_message_time))
      : null,
    // Kept raw and whole rather than promoted field by field. `settings` carries
    // ~52 keys (playoff shape, waiver mode, trade deadline, draft rounds) and we
    // do not yet know which of them a selection rule will want; promoting a
    // guess now and re-crawling later for the rest is the expensive order.
    league_settings: JSON.stringify(league.settings || {}),
    league_metadata: JSON.stringify(league.metadata || {}),
    // Sleeper terminates a league-season chain with the STRING "0", not null,
    // so a plain truthiness check reads the terminator as a real league id and
    // sends the crawler off to fetch league 0. Normalised to null here so the
    // chain walk has a single end-of-chain signal.
    previous_external_league_id: is_league_id(league.previous_league_id)
      ? String(league.previous_league_id)
      : null,
    discovered_via
  }
}

/**
 * Map a Sleeper /league/{id}/users payload to crawl-graph rows.
 *
 * This is the league -> members direction of the graph. The users it yields are
 * frontier nodes: known to exist, never expanded.
 *
 * @param {Object} params
 * @param {Array<Object>} params.users - Raw /league/{id}/users payload
 * @param {string} params.external_league_id
 * @returns {{ users: Array<Object>, memberships: Array<Object> }}
 */
export const parse_sleeper_league_member_users = ({
  users,
  external_league_id
}) => {
  // Deduplicated by user id, keeping the FIRST payload entry per id. A manager
  // appears once per team, so a two-team owner would otherwise yield two rows
  // that differ only by which team was read last.
  const member_by_id = new Map()
  for (const user of users || []) {
    if (!is_sleeper_identifier(user?.user_id)) {
      continue
    }
    const external_user_id = String(user.user_id)
    if (!member_by_id.has(external_user_id)) {
      member_by_id.set(external_user_id, user)
    }
  }

  const members = [...member_by_id.entries()]

  return {
    // display_name and is_bot ARE carried now. This reverses the previous rule
    // here ("no display_name... permanent read-tax on a table whose only jobs
    // are identity and cursor"), which was right while the table was purely a
    // crawl cursor and is wrong now that the graph itself is the deliverable:
    // a manager table nobody can read without a second API call is not much of
    // a map. avatar is still dropped -- it is a content hash with no analytic
    // or human use.
    users: members.map(([external_user_id, user]) => ({
      platform: 'sleeper',
      external_user_id,
      display_name: user.display_name || null,
      // Boolean() rather than passing through: Sleeper omits the key entirely
      // on some payloads, and undefined would insert null ("unknown") for what
      // is actually a known-false.
      is_bot: Boolean(user.is_bot)
    })),
    memberships: members.map(([external_user_id, user]) => ({
      platform: 'sleeper',
      external_league_id: String(external_league_id),
      external_user_id,
      is_owner: Boolean(user.is_owner)
    }))
  }
}

/**
 * Map a Sleeper /user/{id}/leagues/nfl/{season} payload to crawl-graph rows.
 *
 * This is the members -> leagues direction, and it is where new leagues enter
 * the graph. The payload contains FULL league objects, so a complete
 * external_leagues row is derivable here for zero additional requests -- which
 * is what lets a discovered league be persisted immediately rather than held in
 * memory until a later stage gets around to fetching it.
 *
 * @param {Object} params
 * @param {Array<Object>} params.leagues - Raw user-leagues payload
 * @param {string} params.external_user_id - The manager whose list this is
 * @returns {{ leagues: Array<Object>, memberships: Array<Object> }}
 */
export const parse_sleeper_user_leagues = ({ leagues, external_user_id }) => {
  const league_rows = []
  const memberships = []
  const seen = new Set()

  for (const league of leagues || []) {
    const league_row = parse_sleeper_league({
      league,
      discovered_via: 'user_leagues'
    })

    // parse_sleeper_league returns null for an unusable format, which is a
    // league we could never use as evidence -- so it is not worth a graph node
    // either.
    if (!league_row || seen.has(league_row.external_league_id)) {
      continue
    }
    seen.add(league_row.external_league_id)

    league_rows.push({
      ...league_row,
      discovered_from_external_user_id: String(external_user_id)
    })
    memberships.push({
      platform: 'sleeper',
      external_league_id: league_row.external_league_id,
      external_user_id: String(external_user_id)
    })
  }

  return { leagues: league_rows, memberships }
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
      free_agent_acquisition_budget_amount: null
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
      free_agent_acquisition_budget_amount: null
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
      free_agent_acquisition_budget_amount: budget.amount
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
    number_sides:
      (transaction.roster_ids || []).length || receiving_rosters.size
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
