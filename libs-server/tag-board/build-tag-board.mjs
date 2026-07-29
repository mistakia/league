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
 * Two tags REPLACE the contract value rather than freezing it, and a tagged
 * player still shows his pre-tag value in the database until the deadline, so
 * reading live state without this mapping misstates every tagged franchise.
 *
 * The rookie case departs from `get_extension_amount`, which returns the
 * unchanged value. Constitution Article VIII §3 states a rookie tag extends the
 * player for $0, and the cap line follows the constitution.
 */
export const post_deadline_salary = ({
  tag,
  pos,
  extensions,
  value,
  season
}) => {
  if (tag === player_tag_types.ROOKIE) {
    return 0
  }

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
 * Every dollar quantity here is mechanical — contract values, the extension
 * formula, stored franchise prices, tag counts. The only modelled input is
 * dynasty market standing, which is emitted as an ordinal rank and a coverage
 * band and never as a dollar figure, so no consumer can reintroduce a cardinal
 * player valuation.
 *
 * `viewer_tid` scopes the private block. Cutlists and unprocessed restricted
 * free agency offers are loaded only for that franchise, so a rival's private
 * intent has no path into the artifact.
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
  const lever_limits = {
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
      season
    })
    row.untagged = row.tag === player_tag_types.REGULAR
    // Franchise saving is the whole screen: the tag replaces the value, so it
    // only lowers the cap line when the extension price exceeds the position
    // price. Applied below that line it raises the salary.
    row.franchise_saving =
      row.franchise_price === null
        ? null
        : row.extension_price - row.franchise_price
    // A rookie tag sets the contract to $0, so the saving is the whole
    // extension price it replaces.
    row.rookie_saving = row.extension_price
    row.franchise_consecutive_year_ok = passes_consecutive_year_check({
      tid: row.tid,
      pid: row.pid,
      year,
      franchise_tag_history
    })
    row.franchise_eligible = Boolean(
      row.untagged &&
        row.franchise_price !== null &&
        row.franchise_saving > 0 &&
        row.franchise_consecutive_year_ok
    )
    row.rookie_eligible = Boolean(
      row.untagged && row.nfl_draft_year === rookie_class_year
    )
    row.restricted_free_agency_eligible = row.untagged
  }

  // ---- ordinal dynasty standing and rank divergence -----------------------

  const ranked_pool = active_rows.filter((row) => row.dynasty_value !== null)
  const pool_size = ranked_pool.length
  const dynasty_ranks = assign_ranks(ranked_pool, (row) => row.dynasty_value)
  const salary_ranks = assign_ranks(
    ranked_pool,
    (row) => row.post_deadline_salary
  )

  for (const row of active_rows) {
    row.dynasty_rank = dynasty_ranks.get(row.pid) ?? null
    row.salary_rank = salary_ranks.get(row.pid) ?? null
    row.no_market_value = row.dynasty_value === null
    row.rank_precision =
      row.coverage !== null && row.coverage >= COVERAGE_PRECISE_MIN
        ? 'precise'
        : 'band'
    row.dynasty_band = band_for_rank(row.dynasty_rank, pool_size)
    // Positive divergence = paid above market standing. Both ranks run 1 = most
    // (highest salary, highest dynasty value) over the same pool, so a player
    // ranked far worse by the market than by his salary reads positive.
    row.divergence =
      row.dynasty_rank === null || row.salary_rank === null
        ? null
        : row.dynasty_rank - row.salary_rank
  }

  const divergence = active_rows
    .filter((row) => row.divergence !== null && row.untagged)
    .map((row) => ({
      tid: row.tid,
      pid: row.pid,
      name: row.name,
      pos: row.pos,
      salary_rank: row.salary_rank,
      dynasty_rank: row.dynasty_rank,
      dynasty_band: row.dynasty_band,
      rank_precision: row.rank_precision,
      divergence: row.divergence,
      post_deadline_salary: row.post_deadline_salary
    }))
    .sort((a, b) => b.divergence - a.divergence)

  const divergence_by_tid = new Map(team_ids.map((tid) => [tid, []]))
  for (const row of divergence) {
    divergence_by_tid.get(row.tid)?.push(row)
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

  const lever_budget = team_ids.map((tid) => {
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
        limit: lever_limits.franchise,
        spent: franchise_spent,
        remaining: Math.max(0, lever_limits.franchise - franchise_spent)
      },
      rookie: {
        limit: lever_limits.rookie,
        spent: rookie_spent,
        remaining: Math.max(0, lever_limits.rookie - rookie_spent)
      },
      restricted_free_agency: {
        limit: lever_limits.restricted_free_agency,
        spent: rfa_spent,
        remaining: Math.max(0, lever_limits.restricted_free_agency - rfa_spent)
      }
    }
  })
  const lever_budget_by_tid = new Map(lever_budget.map((row) => [row.tid, row]))

  const tag_board = team_ids.map((tid) => {
    const budget = lever_budget_by_tid.get(tid)
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
          eligibility: {
            franchise: row.franchise_eligible && budget.franchise.remaining > 0,
            franchise_consecutive_year_ok: row.franchise_consecutive_year_ok,
            rookie: row.rookie_eligible && budget.rookie.remaining > 0,
            restricted_free_agency:
              row.restricted_free_agency_eligible &&
              budget.restricted_free_agency.remaining > 0
          },
          dynasty_rank: row.dynasty_rank,
          dynasty_band: row.dynasty_band,
          rank_precision: row.rank_precision,
          coverage: row.coverage,
          no_market_value: row.no_market_value,
          salary_rank: row.salary_rank,
          divergence: row.divergence
        }))
        .sort((a, b) => b.post_deadline_salary - a.post_deadline_salary)
    }
  })
  const tag_board_by_tid = new Map(tag_board.map((row) => [row.tid, row]))

  const bid_capacity = team_ids.map((tid) => {
    const exposure = cap_exposure_by_tid.get(tid)
    // Bids clear after the extension deadline, so the room that binds them is
    // the post-extension room, not today's. Room alone is not the constraint:
    // conditional releases and the cutlist drain at execution, so the public
    // substitute for private shed intent is the divergence screen — the
    // contracts the market says are overpaid.
    const attachable_rows = divergence_by_tid
      .get(tid)
      .filter((row) => row.divergence > 0)
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

  const franchise_candidates_by_tid = new Map(
    team_ids.map((tid) => [
      tid,
      rows_by_tid.get(tid).filter((row) => row.franchise_eligible)
    ])
  )
  const rookie_candidates_by_tid = new Map(
    team_ids.map((tid) => [
      tid,
      rows_by_tid.get(tid).filter((row) => row.rookie_eligible)
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

  const incoming_supply = {}
  for (const row of divergence) {
    if (row.divergence > 0) {
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
    unspent_levers: {
      franchise: lever_budget.filter((row) => row.franchise.remaining > 0)
        .length,
      rookie: lever_budget.filter((row) => row.rookie.remaining > 0).length,
      restricted_free_agency: lever_budget.filter(
        (row) => row.restricted_free_agency.remaining > 0
      ).length
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
      budget: lever_budget_by_tid.get(tid),
      capacity: bid_capacity_by_tid.get(tid),
      franchise_candidates: franchise_candidates_by_tid.get(tid),
      rookie_candidates: rookie_candidates_by_tid.get(tid),
      team_divergence: divergence_by_tid.get(tid),
      league_market,
      rfa_window: rfa_schedule_by_tid.get(tid),
      now_unix,
      season,
      viewer_tid,
      viewer_rfa_bids,
      tag_board_by_tid
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
    lever_limits,
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
    lever_budget,
    bid_capacity,
    divergence,
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
      restricted_free_agency_offers: (viewer_rfa_bids || [])
        .filter((row) => row.tid === viewer_tid)
        .map((row) => ({
          pid: row.pid,
          name: players.get(row.pid)?.name || row.pid,
          bid: row.bid,
          // Article IX §4: an outside bid wins only if it strictly exceeds this.
          retention_threshold: row.bid + Math.max(2, Math.round(row.bid * 0.2)),
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
 * decides. "Your levers cannot close the gap" passes. "Franchise this player"
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
  team_divergence,
  league_market,
  rfa_window,
  now_unix,
  season,
  viewer_tid,
  viewer_rfa_bids
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
      rule: 'lever_sufficiency',
      sentence:
        total >= overage
          ? `Your remaining tags can remove up to $${total} from a post-extension salary that sits $${overage} over the cap.`
          : `Your remaining tags can remove at most $${total} from a post-extension salary that sits $${overage} over the cap, so the rest closes by release or trade.`,
      inputs: {
        overage,
        best_franchise_saving: best_franchise,
        best_rookie_saving: best_rookie,
        total_lever_saving: total,
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
      sentence: `No contract on your active roster prices above its position's franchise amount, so the franchise tag has no application for you this year. ${rivals.length} of the other nine teams hold at least one eligible candidate.`,
      inputs: { lever: 'franchise', rival_count: rivals.length, rivals }
    })
  }
  if (budget.rookie.remaining > 0 && rookie_candidates.length === 0) {
    const rivals = league_market.teams_with_rookie_candidate.filter(
      (other) => other !== tid
    )
    fired.push({
      rule: 'empty_screen',
      sentence: `Your active roster carries no untagged player from the most recent completed draft class, so the rookie tag has no application for you this year. ${rivals.length} of the other nine teams hold at least one eligible candidate.`,
      inputs: { lever: 'rookie', rival_count: rivals.length, rivals }
    })
  }

  // Saving and quality diverge
  if (franchise_candidates.length > 1) {
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
        sentence: `Your two restricted free agency nomination turns fall on ${rfa_window.windows.map((w) => w.at_iso.slice(0, 10)).join(' and ')}, fixed by descending draft order.`,
        inputs: rfa_window
      })
    }
  }

  // Your own nomination exposure (viewer-scoped)
  if (viewer_tid === tid && viewer_rfa_bids && viewer_rfa_bids.length) {
    for (const bid of viewer_rfa_bids.filter((row) => row.tid === tid)) {
      const threshold = bid.bid + Math.max(2, Math.round(bid.bid * 0.2))
      fired.push({
        rule: 'own_nomination_exposure',
        sentence: `You have an offer in on ${bid.name || bid.pid}. An outside bid takes him only by strictly exceeding $${threshold}; ties go to you.`,
        inputs: { pid: bid.pid, offer: bid.bid, retention_threshold: threshold }
      })
    }
  }

  // Bidding capacity
  fired.push({
    rule: 'bidding_capacity',
    sentence:
      capacity.cap_room >= 0
        ? `After extensions you hold $${capacity.cap_room} of room, and shedding your ${capacity.attachable_contract_count} contracts the market ranks below their salary would take that to $${capacity.capacity}.`
        : `After extensions you are $${-capacity.cap_room} over the cap, and shedding your ${capacity.attachable_contract_count} contracts the market ranks below their salary would move you to $${capacity.capacity}.`,
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
      sentence: `Shedding every contract the market ranks below its salary still leaves you $${-capacity.capacity} over the cap, so any bid you win has to come out of contracts the market rates.`,
      inputs: { capacity: capacity.capacity }
    })
  }

  // Contracts under pressure
  if (team_divergence.some((row) => row.divergence > 0)) {
    const rows = team_divergence.filter((row) => row.divergence > 0)
    fired.push({
      rule: 'contracts_under_pressure',
      sentence: `${rows.length} of your untagged contracts are paid higher than the dynasty market ranks the player.`,
      inputs: { count: rows.length, pids: rows.map((row) => row.pid) }
    })
  }

  // Incoming supply
  const supply_entries = Object.entries(league_market.incoming_supply)
  if (supply_entries.length) {
    fired.push({
      rule: 'incoming_supply',
      sentence: `League-wide, ${supply_entries.map(([pos, n]) => `${n} ${pos}`).join(', ')} untagged contracts are paid above their market standing — the pool most likely to reach the market when teams shed salary.`,
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
