import get_active_roster_limit from '#libs-shared/get-active-roster-limit.mjs'
import get_extension_amount from '#libs-shared/get-extension-amount.mjs'
import { player_tag_types, roster_slot_types } from '#constants'

// Coverage at or above this reads from more than one source, so adjacent rank
// distinctions carry signal. Below it the composite falls back to a single
// source on the identical scale — the value is not depressed, but neighbouring
// ranks are noise, so the board reports a band instead of a precise rank.
export const COVERAGE_PRECISE_MIN = 0.6

const RANK_BANDS = [
  'top fifth',
  'second fifth',
  'middle fifth',
  'fourth fifth',
  'bottom fifth'
]

const is_active_slot = (slot) => slot >= 1 && slot <= roster_slot_types.BENCH

export const contract_key = (tid, pid) => `${tid}:${pid}`

const franchise_price_for = ({ pos, season }) => {
  switch (pos) {
    case 'QB':
      return season.fqb
    case 'RB':
      return season.frb
    case 'WR':
      return season.fwr
    case 'TE':
      return season.fte
    default:
      return null
  }
}

/**
 * Salary a roster row carries once the extension deadline fires.
 *
 * A franchise tag REPLACES the contract value rather than freezing it, and a
 * tagged player still shows his pre-tag value in the database until the
 * deadline, so reading live state without this mapping misstates every tagged
 * franchise.
 *
 * Note what Constitution Article VIII §3 means by extending a rookie "for $0":
 * the EXTENSION costs $0 where a regular extension adds $5 — the contract keeps
 * its recorded value, it does not become a $0 salary. `get_extension_amount`
 * already encodes that, so this delegates rather than special-casing it.
 *
 * The projection is only valid BEFORE the deadline. Once `ext_date` passes,
 * `scripts/process-extensions.mjs` writes a new transaction carrying the
 * already-extended value AND increments `extensions`, and the board reads
 * contract value as the latest transaction per team/player — so projecting
 * again would apply the ladder a second time off a taller base. A $15 contract
 * with two extensions renders $30 before the deadline and, unguarded, $50
 * after against a true $30. Nothing fails: every regular contract, the cap
 * exposure and the market gap all inflate plausibly. After the deadline the
 * stored value IS the post-deadline salary, for every tag.
 */
export const post_deadline_salary = ({
  tag,
  pos,
  extensions,
  value,
  season,
  now_unix
}) => {
  if (now_unix >= season.ext_date) return value

  return get_extension_amount({
    extensions,
    tag,
    pos,
    league: season,
    value
  })
}

/**
 * Franchise tag eligibility, scoped to the tagging team.
 *
 * Mirrors `libs-server/validate-franchise-tag.mjs` against preloaded history: a
 * player franchise tagged by THIS team in each of the two prior years cannot be
 * tagged again. Note the constitution states the limit player-wide with no team
 * qualifier; the code's team scoping is what the platform actually enforces.
 */
export const passes_consecutive_year_check = ({
  tid,
  pid,
  year,
  franchise_tag_history
}) => {
  const tagged_in = (target_year) =>
    franchise_tag_history.some(
      (row) => row.tid === tid && row.pid === pid && row.year === target_year
    )

  return !(tagged_in(year - 1) && tagged_in(year - 2))
}

/**
 * Resolve the draft class a rookie tag may be applied to: the most recent
 * COMPLETED rookie draft, not the current season's draft year. During the
 * extension window the current class is still undrafted, so encoding the draft
 * year as the season year yields an empty rookie band on every roster.
 */
export const resolve_rookie_class_year = ({ season_rows, now_unix }) => {
  const completed = season_rows.filter((row) => {
    if (row.rookie_draft_completed_at) {
      return row.rookie_draft_completed_at <= now_unix
    }
    return Boolean(row.draft_start) && row.draft_start < now_unix
  })

  if (!completed.length) return null
  return Math.max(...completed.map((row) => row.year))
}

const median = (values) => {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2
    ? sorted[mid]
    : Math.round((sorted[mid - 1] + sorted[mid]) / 2)
}

const band_for_rank = (rank, pool_size) => {
  if (!rank || !pool_size) return null
  const index = Math.min(
    RANK_BANDS.length - 1,
    Math.floor(((rank - 1) / pool_size) * RANK_BANDS.length)
  )
  return RANK_BANDS[index]
}

const assign_ranks = (rows, value_of) => {
  const ranked = [...rows].sort((a, b) => {
    const delta = value_of(b) - value_of(a)
    if (delta !== 0) return delta
    return a.pid < b.pid ? -1 : 1
  })
  const ranks = new Map()
  ranked.forEach((row, index) => ranks.set(row.pid, index + 1))
  return ranks
}

/**
 * Build the league-wide computed board.
 *
 * Every dollar quantity on the tag board is mechanical — contract values, the
 * extension formula, stored franchise prices, tag counts. Two modelled inputs
 * are admitted, each confined to the decision its horizon can carry:
 *
 *   dynasty market standing — emitted as an ordinal rank and a coverage band,
 *     never as a dollar figure, so no MULTI-YEAR (tag) comparison can become
 *     cardinal. It orders the franchise and rookie screens and nothing else.
 *   projected points added  — the replacement floor. Sign only: it vetoes a
 *     franchise candidate and it separates a contract under pressure from a
 *     player who is simply a cut.
 *
 * The one dollar-denominated player value, `projected_market_salary`, appears
 * on `market_pool` rows and nowhere else, where it is differenced against the
 * post-deadline salary to give `market_gap`. Both sides of that subtraction are
 * SINGLE-SEASON dollars on this league's cap, which is the horizon the column
 * prices and the horizon an auction settles — so the gap is in bounds. Do not
 * carry the column onto tag_board rows: differenced against a franchise or
 * rookie price it would reconstruct a multi-year surplus no oracle here
 * supports.
 *
 * There is deliberately NO rank-divergence screen. Ranking a player's dynasty
 * standing against his salary rank mixed a multi-year oracle with a one-season
 * cost, ignored replacement level entirely, and put minimum-salary contracts
 * nobody would think about at the top of a "contracts under pressure" list —
 * 49 of 112 such rows were below replacement. The market gap replaced it.
 *
 * `viewer_tid` scopes the private block. Cutlists are loaded only for that
 * franchise, so a rival's standing intent has no path into the artifact.
 * Restricted free agency offer AMOUNTS are absent for everyone: the loader
 * never selects the bid column, so no retention threshold can be derived
 * downstream even for the offering manager.
 */
export default function build_tag_board({
  lid,
  year,
  now_unix,
  season,
  league_format,
  teams,
  roster_rows,
  contracts,
  franchise_tag_history,
  dynasty_values,
  projected_points_added = new Map(),
  projected_market_salary = new Map(),
  players,
  rookie_class_year,
  viewer_tid = null,
  viewer_cutlist = null,
  viewer_rfa_bids = null
}) {
  const cap_total = league_format.cap
  const active_roster_limit = get_active_roster_limit(league_format)
  const franchise_prices = {
    QB: season.fqb,
    RB: season.frb,
    WR: season.fwr,
    TE: season.fte
  }
  const tag_limits = {
    franchise: season.tag2,
    rookie: season.tag3,
    restricted_free_agency: season.tag4
  }
  const team_ids = teams.map((team) => team.uid)
  const team_name_by_tid = new Map(teams.map((team) => [team.uid, team.name]))

  // ---- player rows -------------------------------------------------------

  const all_rows = roster_rows.map((row) => {
    const player = players.get(row.pid) || {}
    const value = contracts.get(contract_key(row.tid, row.pid)) ?? 0
    const dynasty = dynasty_values.get(row.pid) || null
    return {
      tid: row.tid,
      pid: row.pid,
      name: player.name || row.pid,
      pos: row.pos,
      slot: row.slot,
      tag: row.tag,
      extensions: row.extensions || 0,
      nfl_draft_year: player.nfl_draft_year ?? null,
      value,
      dynasty_value: dynasty ? Number(dynasty.composite_value) : null,
      coverage: dynasty ? Number(dynasty.composite_coverage_score) : null
    }
  })

  const active_rows = all_rows.filter((row) => is_active_slot(row.slot))

  for (const row of active_rows) {
    row.extension_price = row.value + (row.extensions + 1) * 5
    row.franchise_price = franchise_price_for({ pos: row.pos, season })
    row.post_deadline_salary = post_deadline_salary({
      tag: row.tag,
      pos: row.pos,
      extensions: row.extensions,
      value: row.value,
      season,
      now_unix
    })
    row.untagged = row.tag === player_tag_types.REGULAR
    // Franchise saving is the whole screen: the tag replaces the value, so it
    // only lowers the cap line when the extension price exceeds the position
    // price. Applied below that line it raises the salary.
    row.franchise_saving =
      row.franchise_price === null
        ? null
        : row.extension_price - row.franchise_price
    // A rookie tag buys the extension for $0 rather than zeroing the contract,
    // so it saves exactly the extension cost it avoids — the value itself still
    // sits on the cap line either way.
    row.rookie_saving = row.extension_price - row.value
    row.franchise_consecutive_year_ok = passes_consecutive_year_check({
      tid: row.tid,
      pid: row.pid,
      year,
      franchise_tag_history
    })
    // Worth floor. A saving is not a reason to tag a player the league's own
    // projection puts below the starting baseline — the franchise price is then
    // being paid to retain negative production, and the ladder saving measures
    // only how overpaid the contract already was. Points added is the veto
    // because it is the canonical value metric and carries no dollar mapping;
    // the redraft market_salary normalization is deliberately not used here.
    //
    // A missing projection does NOT veto. Coverage annotates rather than
    // suppresses, so an unprojected player stays eligible and carries
    // projection_missing for the page to state.
    row.projected_points_added = projected_points_added.has(row.pid)
      ? projected_points_added.get(row.pid)
      : null
    row.projected_market_salary = projected_market_salary.has(row.pid)
      ? projected_market_salary.get(row.pid)
      : null
    row.projection_missing = row.projected_points_added === null
    row.below_replacement =
      row.projected_points_added !== null && row.projected_points_added <= 0
    row.franchise_eligible = Boolean(
      row.untagged &&
        row.franchise_price !== null &&
        row.franchise_saving > 0 &&
        row.franchise_consecutive_year_ok &&
        !row.below_replacement
    )
    row.rookie_eligible = Boolean(
      row.untagged && row.nfl_draft_year === rookie_class_year
    )
    row.restricted_free_agency_eligible = row.untagged
  }

  // ---- ordinal dynasty standing -------------------------------------------
  //
  // Dynasty rank orders MULTI-YEAR decisions (the franchise and rookie screens)
  // and is emitted as an ordinal only. It does not screen contracts: comparing
  // a player's dynasty rank against his salary rank was the board's original
  // "divergence" screen and has been removed — see the market gap below.

  const ranked_pool = active_rows.filter((row) => row.dynasty_value !== null)
  const pool_size = ranked_pool.length
  const dynasty_ranks = assign_ranks(ranked_pool, (row) => row.dynasty_value)

  for (const row of active_rows) {
    row.dynasty_rank = dynasty_ranks.get(row.pid) ?? null
    row.no_market_value = row.dynasty_value === null
    row.rank_precision =
      row.coverage !== null && row.coverage >= COVERAGE_PRECISE_MIN
        ? 'precise'
        : 'band'
    row.dynasty_band = band_for_rank(row.dynasty_rank, pool_size)
    // Single-season market gap: what this contract costs above what the
    // auction would pay for the same player this season. Both sides are
    // one-season dollars normalized to this league's cap, which is the one
    // horizon `market_salary` can price. Null when the player carries no
    // projection row — unscreenable, never dropped.
    row.market_gap =
      row.projected_market_salary === null
        ? null
        : row.post_deadline_salary - row.projected_market_salary
  }

  // ---- per-team aggregates -----------------------------------------------

  const rows_by_tid = new Map(team_ids.map((tid) => [tid, []]))
  for (const row of active_rows) {
    rows_by_tid.get(row.tid)?.push(row)
  }

  const all_rows_by_tid = new Map(team_ids.map((tid) => [tid, []]))
  for (const row of all_rows) {
    all_rows_by_tid.get(row.tid)?.push(row)
  }

  const cap_exposure = team_ids.map((tid) => {
    const rows = rows_by_tid.get(tid)
    const current_salary = rows.reduce((sum, row) => sum + row.value, 0)
    const post_extension_salary = rows.reduce(
      (sum, row) => sum + row.post_deadline_salary,
      0
    )
    return {
      tid,
      name: team_name_by_tid.get(tid),
      active_roster_count: rows.length,
      current_salary,
      post_extension_salary,
      current_room: cap_total - current_salary,
      post_extension_room: cap_total - post_extension_salary
    }
  })
  const cap_exposure_by_tid = new Map(cap_exposure.map((row) => [row.tid, row]))

  const tag_budget = team_ids.map((tid) => {
    // Tag counts are taken over the whole roster, matching `roster.mjs`
    // `isEligibleForTag`, not just the active roster.
    const rows = all_rows_by_tid.get(tid)
    const spent = (tag) => rows.filter((row) => row.tag === tag).length
    const franchise_spent = spent(player_tag_types.FRANCHISE)
    const rookie_spent = spent(player_tag_types.ROOKIE)
    const rfa_spent = spent(player_tag_types.RESTRICTED_FREE_AGENCY)
    return {
      tid,
      name: team_name_by_tid.get(tid),
      franchise: {
        limit: tag_limits.franchise,
        spent: franchise_spent,
        remaining: Math.max(0, tag_limits.franchise - franchise_spent)
      },
      rookie: {
        limit: tag_limits.rookie,
        spent: rookie_spent,
        remaining: Math.max(0, tag_limits.rookie - rookie_spent)
      },
      restricted_free_agency: {
        limit: tag_limits.restricted_free_agency,
        spent: rfa_spent,
        remaining: Math.max(0, tag_limits.restricted_free_agency - rfa_spent)
      }
    }
  })
  const tag_budget_by_tid = new Map(tag_budget.map((row) => [row.tid, row]))

  // ---- market pool --------------------------------------------------------
  //
  // Every untagged active-roster contract, priced against the single-season
  // market. Two nested subsets come off it, and they are deliberately not the
  // same set:
  //
  //   gap > 0            — the SHED pool. Salary a team could plausibly clear,
  //                        which is what funds a bid. Below-replacement
  //                        contracts all land here (their market price is at or
  //                        near zero), and they are the easiest releases, so
  //                        this set must stay wide.
  //   ...and pts_added>0 — UNDER PRESSURE. The decision-bearing subset: players
  //                        who help the roster but are priced above what a
  //                        season of them is worth. A below-replacement player
  //                        is not under pressure, he is simply a cut, and
  //                        listing him as a decision buried the real ones.
  //
  // The under-pressure set is also the restricted-free-agency nomination pool:
  // the gap is exactly the reason an owner would send a player to auction (the
  // ladder price exceeds a season's worth of him) and the reason a rival would
  // bid (the owner is unlikely to retain at that price).
  const market_pool = active_rows
    .filter((row) => row.untagged)
    .map((row) => {
      const under_pressure =
        row.market_gap !== null &&
        row.market_gap > 0 &&
        row.projected_points_added !== null &&
        row.projected_points_added > 0
      return {
        tid: row.tid,
        pid: row.pid,
        name: row.name,
        pos: row.pos,
        post_deadline_salary: row.post_deadline_salary,
        // Auction-horizon price. Present here and nowhere else on the board:
        // this pool describes contracts that could reach a single-season
        // auction, which is the only decision a single-season projection can
        // price. Never carried onto tag_board rows, where differencing it
        // against a franchise price would reconstruct a multi-year surplus.
        projected_market_salary: row.projected_market_salary,
        market_gap: row.market_gap,
        projected_points_added: row.projected_points_added,
        below_replacement: row.below_replacement,
        projection_missing: row.projection_missing,
        under_pressure,
        rfa_nomination_target:
          under_pressure &&
          tag_budget_by_tid.get(row.tid).restricted_free_agency.remaining > 0,
        dynasty_rank: row.dynasty_rank,
        dynasty_band: row.dynasty_band,
        rank_precision: row.rank_precision,
        no_market_value: row.no_market_value
      }
    })
    // Widest gap first; an unscreenable row (no market price) sorts last rather
    // than dropping out.
    .sort((a, b) => {
      if (a.market_gap === null) return b.market_gap === null ? 0 : 1
      if (b.market_gap === null) return -1
      return b.market_gap - a.market_gap
    })

  const market_pool_by_tid = new Map(team_ids.map((tid) => [tid, []]))
  for (const row of market_pool) {
    market_pool_by_tid.get(row.tid)?.push(row)
  }

  const tag_board = team_ids.map((tid) => {
    const budget = tag_budget_by_tid.get(tid)
    const rows = rows_by_tid.get(tid)
    return {
      tid,
      name: team_name_by_tid.get(tid),
      players: rows
        .map((row) => ({
          pid: row.pid,
          name: row.name,
          pos: row.pos,
          value: row.value,
          extensions: row.extensions,
          tag: row.tag,
          extension_price: row.extension_price,
          franchise_price: row.franchise_price,
          post_deadline_salary: row.post_deadline_salary,
          franchise_saving: row.franchise_saving,
          rookie_saving: row.rookie_saving,
          nfl_draft_year: row.nfl_draft_year,
          projected_points_added: row.projected_points_added,
          below_replacement: row.below_replacement,
          projection_missing: row.projection_missing,
          eligibility: {
            franchise: row.franchise_eligible && budget.franchise.remaining > 0,
            franchise_consecutive_year_ok: row.franchise_consecutive_year_ok,
            franchise_worth_ok: !row.below_replacement,
            rookie: row.rookie_eligible && budget.rookie.remaining > 0,
            restricted_free_agency:
              row.restricted_free_agency_eligible &&
              budget.restricted_free_agency.remaining > 0
          },
          dynasty_rank: row.dynasty_rank,
          dynasty_band: row.dynasty_band,
          rank_precision: row.rank_precision,
          coverage: row.coverage,
          no_market_value: row.no_market_value
        }))
        .sort((a, b) => b.post_deadline_salary - a.post_deadline_salary)
    }
  })

  const bid_capacity = team_ids.map((tid) => {
    const exposure = cap_exposure_by_tid.get(tid)
    // Bids clear after the extension deadline, so the room that binds them is
    // the post-extension room, not today's. Room alone is not the constraint:
    // conditional releases and the cutlist drain at execution, so the public
    // substitute for private shed intent is the shed pool — every contract
    // priced above the single-season market, below-replacement ones included.
    const attachable_rows = market_pool_by_tid
      .get(tid)
      .filter((row) => row.market_gap > 0)
    const attachable_release_salary = attachable_rows.reduce(
      (sum, row) => sum + row.post_deadline_salary,
      0
    )
    return {
      tid,
      name: team_name_by_tid.get(tid),
      cap_room: exposure.post_extension_room,
      attachable_release_salary,
      attachable_contract_count: attachable_rows.length,
      capacity: exposure.post_extension_room + attachable_release_salary,
      open_active_roster_spots:
        active_roster_limit - exposure.active_roster_count
    }
  })
  const bid_capacity_by_tid = new Map(bid_capacity.map((row) => [row.tid, row]))

  // ---- restricted free agency nomination schedule -------------------------

  const rfa_schedule = build_rfa_schedule({ season, teams })
  const rfa_schedule_by_tid = new Map(rfa_schedule.map((row) => [row.tid, row]))

  // ---- league market ------------------------------------------------------

  const positional_supply = {}
  for (const row of active_rows) {
    positional_supply[row.pos] = (positional_supply[row.pos] || 0) + 1
  }

  // Candidate lists are tag-budget-netted: a team that has already spent its
  // franchise tag holds no franchise candidate, because it cannot act on one.
  // `row.franchise_eligible` is the mechanical screen alone and says nothing
  // about the budget, so every rival-facing aggregate below — candidate
  // concentration, the teams_with_* lists, and the empty_screen rival count —
  // must apply the budget here rather than read the screen directly. Netting
  // once at construction is what keeps them from disagreeing with the
  // `eligibility.*` flags on the tag_board rows, which have always netted it.
  const franchise_candidates_by_tid = new Map(
    team_ids.map((tid) => [
      tid,
      tag_budget_by_tid.get(tid).franchise.remaining > 0
        ? rows_by_tid.get(tid).filter((row) => row.franchise_eligible)
        : []
    ])
  )
  const rookie_candidates_by_tid = new Map(
    team_ids.map((tid) => [
      tid,
      tag_budget_by_tid.get(tid).rookie.remaining > 0
        ? rows_by_tid.get(tid).filter((row) => row.rookie_eligible)
        : []
    ])
  )

  const candidate_concentration = {}
  for (const tid of team_ids) {
    for (const row of franchise_candidates_by_tid.get(tid)) {
      if (!candidate_concentration[row.pos]) {
        candidate_concentration[row.pos] = { candidates: 0, teams: [] }
      }
      candidate_concentration[row.pos].candidates += 1
      if (!candidate_concentration[row.pos].teams.includes(tid)) {
        candidate_concentration[row.pos].teams.push(tid)
      }
    }
  }

  // Incoming supply counts the UNDER-PRESSURE subset, not the whole shed pool:
  // it answers "who could reach the auction", and a below-replacement contract
  // reaching free agency is not supply anyone competes for.
  const incoming_supply = {}
  for (const row of market_pool) {
    if (row.under_pressure) {
      incoming_supply[row.pos] = (incoming_supply[row.pos] || 0) + 1
    }
  }

  const overages = cap_exposure.map((row) => row.post_extension_room)
  const league_market = {
    positional_supply,
    incoming_supply,
    candidate_concentration,
    post_extension_room: {
      min: Math.min(...overages),
      median: median(overages),
      max: Math.max(...overages),
      teams_over_cap: overages.filter((room) => room < 0).length,
      by_tid: cap_exposure
        .map((row) => ({
          tid: row.tid,
          post_extension_room: row.post_extension_room
        }))
        .sort((a, b) => a.post_extension_room - b.post_extension_room)
    },
    // two distinct quantities, and they differ wherever a tag's per-team
    // limit exceeds one. franchise and rookie are capped at one apiece so the
    // team count and the tag count coincide; restricted free agency allows two
    // nominations, so nine teams holding a nomination is eighteen unspent
    // nominations. rendering one as the other understates available supply by
    // half, which is why the key names the unit rather than saying "unspent".
    teams_with_unspent_tag: {
      franchise: tag_budget.filter((row) => row.franchise.remaining > 0).length,
      rookie: tag_budget.filter((row) => row.rookie.remaining > 0).length,
      restricted_free_agency: tag_budget.filter(
        (row) => row.restricted_free_agency.remaining > 0
      ).length
    },
    unspent_tag_count: {
      franchise: tag_budget.reduce(
        (sum, row) => sum + row.franchise.remaining,
        0
      ),
      rookie: tag_budget.reduce((sum, row) => sum + row.rookie.remaining, 0),
      restricted_free_agency: tag_budget.reduce(
        (sum, row) => sum + row.restricted_free_agency.remaining,
        0
      )
    },
    teams_with_franchise_candidate: team_ids.filter(
      (tid) => franchise_candidates_by_tid.get(tid).length > 0
    ),
    teams_with_rookie_candidate: team_ids.filter(
      (tid) => rookie_candidates_by_tid.get(tid).length > 0
    )
  }

  // ---- considerations -----------------------------------------------------

  const considerations = {}
  for (const tid of team_ids) {
    considerations[tid] = build_considerations({
      tid,
      exposure: cap_exposure_by_tid.get(tid),
      budget: tag_budget_by_tid.get(tid),
      capacity: bid_capacity_by_tid.get(tid),
      franchise_candidates: franchise_candidates_by_tid.get(tid),
      rookie_candidates: rookie_candidates_by_tid.get(tid),
      team_market_pool: market_pool_by_tid.get(tid),
      league_market,
      rfa_window: rfa_schedule_by_tid.get(tid),
      now_unix,
      season,
      team_count: team_ids.length
    })
  }

  // ---- private block ------------------------------------------------------

  const board = {
    generated_at: new Date(now_unix * 1000).toISOString(),
    lid,
    year,
    league_format_id: season.league_format_id,
    cap_total,
    active_roster_limit,
    franchise_prices,
    tag_limits,
    rookie_eligible_draft_class: rookie_class_year,
    dynasty_market_pool_size: pool_size,
    coverage_precise_min: COVERAGE_PRECISE_MIN,
    calendar_freshness: build_calendar_freshness({ season, now_unix }),
    teams: teams.map((team) => ({
      tid: team.uid,
      name: team.name,
      draft_order: team.draft_order
    })),
    cap_exposure,
    tag_board,
    tag_budget,
    bid_capacity,
    market_pool,
    rfa_schedule,
    league_market,
    considerations
  }

  if (viewer_tid !== null) {
    board.viewer_tid = viewer_tid
    board.private = {
      tid: viewer_tid,
      cutlist: (viewer_cutlist || [])
        .filter((row) => row.tid === viewer_tid)
        .map((row) => ({
          pid: row.pid,
          name: players.get(row.pid)?.name || row.pid,
          sort_order: row.sort_order
        }))
        .sort((a, b) => a.sort_order - b.sort_order),
      // Offer AMOUNTS never enter the board. The loader does not select the bid
      // column, so no retention threshold can be derived here either — both are
      // absent by construction rather than filtered downstream.
      restricted_free_agency_offers: (viewer_rfa_bids || [])
        .filter((row) => row.tid === viewer_tid)
        .map((row) => ({
          pid: row.pid,
          name: players.get(row.pid)?.name || row.pid,
          submitted: row.submitted,
          announced: row.announced
        }))
    }
  }

  return board
}

const DAY_SECONDS = 24 * 60 * 60

/**
 * Nomination order runs one team per day in descending draft order from the
 * start of the period, cycling until each team has had its two turns.
 * `get-restricted-free-agency-nomination-info.mjs` encodes the same ordering but
 * returns null outside the window, so the schedule is derived here to stay
 * available during the extension window when managers are planning.
 */
export const build_rfa_schedule = ({ season, teams }) => {
  const start = season.restricted_free_agency_period_start
  if (!start) return []

  const sorted = [...teams].sort(
    (a, b) => (b.draft_order || 0) - (a.draft_order || 0)
  )
  const turns = season.tag4 || 2

  return sorted.map((team, index) => {
    const windows = []
    for (let turn = 0; turn < turns; turn += 1) {
      const at = start + (index + turn * sorted.length) * DAY_SECONDS
      windows.push({
        turn: turn + 1,
        at_iso: new Date(at * 1000).toISOString()
      })
    }
    return {
      tid: team.uid,
      name: team.name,
      draft_order: team.draft_order,
      nomination_position: index + 1,
      windows
    }
  })
}

const CALENDAR_EVENTS = [
  ['Extension Deadline', 'ext_date'],
  ['Restricted Free Agency Begins', 'restricted_free_agency_period_start'],
  ['Restricted Free Agency Ends', 'restricted_free_agency_period_end'],
  ['Rookie Draft', 'draft_start'],
  ['Free Agency Period Begins', 'free_agency_period_start'],
  ['Free Agency Auction Begins', 'free_agency_live_auction_start'],
  ['Free Agency Auction Ends', 'free_agency_live_auction_end'],
  ['Free Agency Period Ends', 'free_agency_period_end'],
  ['Trade Deadline', 'tddate']
]

/**
 * Deadlines are read from the `seasons` row at computation time and stamped
 * with that read. The seeded pages went stale silently when the commissioner
 * moved a date, so a consumer can compare `read_at` against its own clock.
 */
export const build_calendar_freshness = ({ season, now_unix }) => {
  const calendar = CALENDAR_EVENTS.map(([label, field]) => {
    const at = season[field]
    if (!at) return null
    return {
      label,
      field,
      at_iso: new Date(at * 1000).toISOString(),
      days_out: Math.round((at - now_unix) / DAY_SECONDS)
    }
  }).filter(Boolean)

  const future = calendar
    .filter((event) => event.days_out >= 0)
    .sort((a, b) => a.days_out - b.days_out)

  return {
    read_at_iso: new Date(now_unix * 1000).toISOString(),
    source: 'seasons',
    stale_after_hours: 24,
    next_deadline: future[0] || null,
    calendar
  }
}

/**
 * Consideration rules. Each is a mechanical predicate over board fields paired
 * with a sentence naming a tension, constraint or comparison.
 *
 * The boundary every sentence must hold: it remains true whatever the manager
 * decides. "Your tags cannot close the gap" passes. "Franchise this player"
 * does not. Rules ship here rather than as flags a prompt phrases, because
 * drift in the phrasing is drift into prescription.
 */
export const build_considerations = ({
  tid,
  exposure,
  budget,
  capacity,
  franchise_candidates,
  rookie_candidates,
  team_market_pool,
  league_market,
  rfa_window,
  now_unix,
  season,
  team_count
}) => {
  const fired = []
  const overage =
    exposure.post_extension_room < 0 ? -exposure.post_extension_room : 0

  // Lever sufficiency
  if (overage > 0) {
    const best_franchise =
      budget.franchise.remaining > 0
        ? Math.max(
            0,
            ...franchise_candidates.map((row) => row.franchise_saving)
          )
        : 0
    const best_rookie =
      budget.rookie.remaining > 0
        ? Math.max(0, ...rookie_candidates.map((row) => row.rookie_saving))
        : 0
    const total = best_franchise + best_rookie
    fired.push({
      rule: 'tag_sufficiency',
      sentence:
        total >= overage
          ? `Your remaining tags can remove up to $${total} from a post-extension salary that sits $${overage} over the cap.`
          : `Your remaining tags can remove at most $${total} from a post-extension salary that sits $${overage} over the cap, so the rest closes by release or trade.`,
      inputs: {
        overage,
        best_franchise_saving: best_franchise,
        best_rookie_saving: best_rookie,
        total_tag_saving: total,
        closes_gap: total >= overage
      }
    })
  }

  // Empty screen
  if (budget.franchise.remaining > 0 && franchise_candidates.length === 0) {
    const rivals = league_market.teams_with_franchise_candidate.filter(
      (other) => other !== tid
    )
    fired.push({
      rule: 'empty_screen',
      sentence: `No contract on your active roster prices above its position's franchise amount, so the franchise tag has no application for you this year. ${rivals.length} of the other ${team_count - 1} teams hold an eligible candidate and still have the tag to spend.`,
      inputs: { tag: 'franchise', rival_count: rivals.length, rivals }
    })
  }
  if (budget.rookie.remaining > 0 && rookie_candidates.length === 0) {
    const rivals = league_market.teams_with_rookie_candidate.filter(
      (other) => other !== tid
    )
    fired.push({
      rule: 'empty_screen',
      sentence: `Your active roster carries no untagged player from the most recent completed draft class, so the rookie tag has no application for you this year. ${rivals.length} of the other ${team_count - 1} teams hold an eligible candidate and still have the tag to spend.`,
      inputs: { tag: 'rookie', rival_count: rivals.length, rivals }
    })
  }

  // Saving and quality diverge. Gated on the tag still being available, like
  // tag_sufficiency and empty_screen above — a team that has already spent its
  // franchise tag cannot act on the tension, so naming it is noise.
  if (budget.franchise.remaining > 0 && franchise_candidates.length > 1) {
    const by_saving = [...franchise_candidates].sort(
      (a, b) => b.franchise_saving - a.franchise_saving
    )[0]
    const ranked = franchise_candidates.filter(
      (row) => row.dynasty_rank !== null
    )
    const by_rank = ranked.length
      ? [...ranked].sort((a, b) => a.dynasty_rank - b.dynasty_rank)[0]
      : null
    if (by_rank && by_rank.pid !== by_saving.pid) {
      fired.push({
        rule: 'saving_and_quality_diverge',
        sentence: `Your largest franchise saving and your best-ranked franchise candidate are different players: ${by_saving.name} saves $${by_saving.franchise_saving}, while ${by_rank.name} stands higher in the dynasty market.`,
        inputs: {
          largest_saving: {
            pid: by_saving.pid,
            name: by_saving.name,
            franchise_saving: by_saving.franchise_saving
          },
          best_ranked: {
            pid: by_rank.pid,
            name: by_rank.name,
            dynasty_rank: by_rank.dynasty_rank,
            rank_precision: by_rank.rank_precision
          }
        }
      })
    }
  }

  // Your nomination windows
  if (rfa_window && rfa_window.windows.length) {
    const in_period =
      season.restricted_free_agency_period_start &&
      now_unix >= season.restricted_free_agency_period_start &&
      now_unix <= season.restricted_free_agency_period_end
    if (in_period) {
      fired.push({
        rule: 'nomination_windows',
        sentence: `Your ${rfa_window.windows.length} restricted free agency nomination turns fall on ${rfa_window.windows.map((w) => w.at_iso.slice(0, 10)).join(' and ')}, fixed by descending draft order.`,
        inputs: rfa_window
      })
    }
  }

  // There is deliberately no own-nomination-exposure rule. It existed to state
  // a retention threshold derived from the offer amount, and the amount no
  // longer reaches this code. The threshold is Article IX arithmetic the
  // manager can apply themselves; restating it per page was never the board's
  // job. The private block reports that a nomination exists.

  // Bidding capacity
  fired.push({
    rule: 'bidding_capacity',
    sentence:
      capacity.cap_room >= 0
        ? `After extensions you hold $${capacity.cap_room} of room, and shedding your ${capacity.attachable_contract_count} contracts priced above the single-season market would take that to $${capacity.capacity}.`
        : `After extensions you are $${-capacity.cap_room} over the cap, and shedding your ${capacity.attachable_contract_count} contracts priced above the single-season market would move you to $${capacity.capacity}.`,
    inputs: {
      cap_room: capacity.cap_room,
      attachable_release_salary: capacity.attachable_release_salary,
      capacity: capacity.capacity
    }
  })

  // Constrained bidder
  if (capacity.capacity < 0) {
    fired.push({
      rule: 'constrained_bidder',
      sentence: `Shedding every contract priced above the single-season market still leaves you $${-capacity.capacity} over the cap, so any bid you win has to come out of contracts the market rates.`,
      inputs: { capacity: capacity.capacity }
    })
  }

  // Contracts under pressure
  if (team_market_pool.some((row) => row.under_pressure)) {
    const rows = team_market_pool.filter((row) => row.under_pressure)
    const total_gap = rows.reduce((sum, row) => sum + row.market_gap, 0)
    fired.push({
      rule: 'contracts_under_pressure',
      sentence: `${rows.length} of your untagged contracts pay a player who helps the roster more than a season of him is worth, $${total_gap} above the market in total.`,
      inputs: {
        count: rows.length,
        total_market_gap: total_gap,
        pids: rows.map((row) => row.pid)
      }
    })
  }

  // Incoming supply
  const supply_entries = Object.entries(league_market.incoming_supply)
  if (supply_entries.length) {
    fired.push({
      rule: 'incoming_supply',
      sentence: `League-wide, ${supply_entries.map(([pos, n]) => `${n} ${pos}`).join(', ')} untagged contracts are priced above a season of the player — the pool a nomination or a release is most likely to move.`,
      inputs: league_market.incoming_supply
    })
  }

  // Execution risk
  if (capacity.open_active_roster_spots <= 0) {
    fired.push({
      rule: 'execution_risk',
      sentence: `Your active roster is at its limit of ${exposure.active_roster_count}, so a winning bid has to be paired with a release to execute.`,
      inputs: {
        active_roster_count: exposure.active_roster_count,
        open_active_roster_spots: capacity.open_active_roster_spots
      }
    })
  }

  return fired
}
