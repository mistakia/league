import get_active_roster_limit from '#libs-shared/get-active-roster-limit.mjs'
import get_extension_amount from '#libs-shared/get-extension-amount.mjs'
import timestamptz_to_epoch from '#libs-shared/timestamptz-to-epoch.mjs'
import { player_tag_types, roster_slot_types } from '#constants'

// Coverage at or above this reads from more than one source, so adjacent rank
// distinctions carry signal. Below it the composite falls back to a single
// source on the identical scale — the value is not depressed, but neighbouring
// ranks are noise, so the board reports a band instead of a precise rank.
export const COVERAGE_PRECISE_MIN = 0.6

// What makes a contract a restricted-free-agency nomination candidate. The gap
// alone does not: it says the contract is mispriced, not that anyone would move
// on it. Two conditions hold together.
//
// 1. The owner is paying real money — at least this much above the single-season
//    market. Below it the salary shed is not worth a nomination whatever the
//    proportion, which is why this is a flat dollar figure and not a
//    gap-to-salary ratio: a ratio is noisiest exactly at the cheap end, and it
//    inverts the motivating case, keeping a $5 contract with a $3 gap at 0.60
//    while dropping an $11 contract with a $2 gap at 0.18.
export const RESTRICTED_FREE_AGENCY_NOMINATION_MINIMUM_MARKET_GAP = 6

// 2. The player is NEAR replacement level OR BETTER — no further than this many
//    projected points added BELOW it, with no ceiling above. This is the
//    condition the gap cannot supply, and it cuts the lower tail only: a
//    contract far below replacement has no bidder at any price, so its owner
//    releases rather than nominates (K.Pickett is −218.4). There is deliberately
//    no upper bound. A nomination re-prices the owner's own contract through the
//    auction and resets the extension count on a successful acquisition, so a
//    star paid above the single-season market is a candidate on exactly the same
//    reasoning as a marginal starter — the owner is overpaying either way, and
//    Article IX's retention margin is what he uses to keep the player. The
//    earlier two-sided form excluded that whole population.
export const RESTRICTED_FREE_AGENCY_NOMINATION_REPLACEMENT_FLOOR_POINTS = -25

// The shed pool's entry condition: a contract priced at least this much above
// the single-season market. It replaced a bare `market_gap > 0` on 2026-07-31,
// because a $1–$2 gap is not a contract anyone sheds — B.Bowers at a $2 gap was
// the second-ranked player in the whole pool and still counted $18 toward his
// owner's releasable salary, which is what "releasable" must never claim.
//
// $3 is the LARGEST buffer that is not secretly a salary floor, and that is the
// whole reason it is $3 rather than the $6 the nomination screen uses. A $5
// minimum contract prices at $0 at best, so its gap can never exceed $5: any
// threshold above $5 removes every minimum contract from the pool, not for
// being fairly priced but for being cheap. That is exactly the cut
// user:guideline/nfl/home-dynasty-league/write-team-homepage.md forbids, and at $6
// it would have deleted 25 of 76 live rows — the rows that matter most when
// rosters are full and a rival shedding a $5 player opens the roster spot.
//
// The nomination screen's $6 minimum is NOT the same mistake. A nomination is a
// scarce resource (two per franchise), so a flat dollar minimum is a real screen
// there: spending one of two nominations to reclaim $5 is not a move. Capacity
// has no such scarcity, so the same figure would be doing a different job.
export const SHED_POOL_MINIMUM_MARKET_GAP = 3

// What separates a contract its owner would actually shed from one merely priced
// above the market. The test is a RATIO, not a dollar figure: the market prices
// him at half or less of what the contract costs, so an auction — open free
// agency, or the owner's own restricted-free-agency nomination — plausibly
// returns him below the current salary. A manager sheds a contract he can
// re-acquire cheaper; he does not shed one the market rates at what he is paying,
// however large the absolute gap.
//
// This is deliberately the opposite shape from the nomination minimum above, and
// for the opposite reason. There the question is "is the saving worth a scarce
// nomination", which is an absolute amount. Here it is "could this player be
// had for less", which is proportional and has no scarce resource to spend.
//
// 0.5 is where the live board separates the two populations cleanly: it keeps
// J.Jacobs ($60 against a $26 market, 0.43) and N.Collins ($30/$11, 0.37), and
// drops L.Jackson ($55/$48, 0.87), B.Purdy ($44/$38, 0.86) and C.Stroud
// ($23/$22, 0.96) — contracts with a real gap and nothing to recover.
//
// A second condition was specified and then dropped as provably redundant:
// "significantly below replacement AND priced at $0–2" selects ZERO rows this
// ratio does not already select. `market_salary` is DERIVED from `pts_added`, so
// a below-replacement player always prices at $0–2, and $0–2 against any
// contract of $5 or more is always under half. Live check: 0 of 106 rows sit
// below replacement priced above $2. If `market_salary` ever stops being derived
// from `pts_added`, that redundancy breaks and the second condition must return.
export const RELEASABLE_MARKET_PRICE_RATIO = 0.5

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
      return season.franchise_tag_salary_quarterback
    case 'RB':
      return season.franchise_tag_salary_running_back
    case 'WR':
      return season.franchise_tag_salary_wide_receiver
    case 'TE':
      return season.franchise_tag_salary_tight_end
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
 * The projection is only valid until the extensions are PROCESSED.
 * `scripts/process-extensions.mjs` writes a new transaction carrying the
 * already-extended value AND increments `extensions`, and the board reads
 * contract value as the latest transaction per team/player — so projecting
 * again would apply the ladder a second time off a taller base. A $15 contract
 * with two extensions renders $30 before processing and, unguarded, $50 after
 * against a true $30. Once processed, the stored value IS the post-deadline
 * salary, for every tag.
 *
 * The predicate is whether those transactions EXIST, never the clock. Keying it
 * on `now_unix >= season.extension_deadline_at` is wrong for the whole window between the
 * deadline and the five-minute cron that processes it: the branch flips on time,
 * the data lands minutes later, and in between the board returns a value that
 * has not been extended yet. That understates every regular contract by its
 * ladder step, and reads a franchise-tagged player at his pre-tag value rather
 * than the settled position price. Nothing fails — cap exposure, the market gap,
 * the shed pool and every capacity ranking derived from them simply move
 * together in the understating direction, which is the same silent-plausible
 * failure as the double-ladder it replaced.
 *
 * A restricted free agency tag is priced as REGULAR, mirroring the coercion
 * `scripts/process-extensions.mjs` performs before it calls the same primitive.
 * That script is the writer of record, so a tag-4 player is charged the ordinary
 * ladder at the deadline and the projection has to say so. Delegating the tag
 * straight through instead reaches `get_extension_amount`'s `bid ?? value` arm,
 * which returns the stored value when no bid is attached — correct for the CAP
 * charge that arm exists to price, and wrong here, because it is the salary
 * BEFORE the deadline rather than after it. Confirmed against league 1: all 14
 * tag-4 players carry a 2026 EXTENSION transaction at the ladder price and none
 * at their stored value.
 */
export const post_deadline_salary = ({
  tag,
  pos,
  extensions,
  player_salary,
  season,
  extensions_processed
}) => {
  if (extensions_processed) return player_salary

  return get_extension_amount({
    extensions,
    tag:
      tag === player_tag_types.RESTRICTED_FREE_AGENCY
        ? player_tag_types.REGULAR
        : tag,
    pos,
    league: season,
    player_salary
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
      (row) =>
        row.tid === tid && row.pid === pid && row.season_year === target_year
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
    // Both are `seasons` timestamptz columns; now_unix is epoch seconds.
    if (row.rookie_draft_completed_at) {
      return timestamptz_to_epoch(row.rookie_draft_completed_at) <= now_unix
    }
    return (
      Boolean(row.draft_start) &&
      timestamptz_to_epoch(row.draft_start) < now_unix
    )
  })

  if (!completed.length) return null
  return Math.max(...completed.map((row) => row.season_year))
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
  // Whether process-extensions.mjs has written this season's EXTENSION
  // transactions yet. Defaults to the unprocessed state, in which the board
  // projects the ladder — the correct reading both before the deadline and in
  // the window after it while the cron has not yet run.
  extensions_processed = false,
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
  const cap_total = league_format.salary_cap
  const active_roster_limit = get_active_roster_limit(league_format)
  const franchise_prices = {
    QB: season.franchise_tag_salary_quarterback,
    RB: season.franchise_tag_salary_running_back,
    WR: season.franchise_tag_salary_wide_receiver,
    TE: season.franchise_tag_salary_tight_end
  }
  const tag_limits = {
    franchise: season.franchise_tag_limit,
    rookie: season.rookie_tag_limit,
    restricted_free_agency: season.restricted_free_agency_tag_limit
  }
  const team_ids = teams.map((team) => team.team_id)
  const team_name_by_tid = new Map(
    teams.map((team) => [team.team_id, team.name])
  )

  // ---- player rows -------------------------------------------------------

  const all_rows = roster_rows.map((row) => {
    const player = players.get(row.pid) || {}
    const player_salary = contracts.get(contract_key(row.tid, row.pid)) ?? 0
    const dynasty = dynasty_values.get(row.pid) || null
    return {
      tid: row.tid,
      pid: row.pid,
      name: player.name || row.pid,
      pos: row.player_position,
      slot: row.slot,
      tag: row.tag,
      extensions: row.extensions || 0,
      nfl_draft_year: player.nfl_draft_year ?? null,
      player_salary,
      dynasty_value: dynasty ? Number(dynasty.composite_value) : null,
      coverage: dynasty ? Number(dynasty.composite_coverage_score) : null
    }
  })

  const active_rows = all_rows.filter((row) => is_active_slot(row.slot))

  for (const row of active_rows) {
    row.extension_price = row.player_salary + (row.extensions + 1) * 5
    row.franchise_price = franchise_price_for({ pos: row.pos, season })
    row.post_deadline_salary = post_deadline_salary({
      tag: row.tag,
      pos: row.pos,
      extensions: row.extensions,
      player_salary: row.player_salary,
      season,
      extensions_processed
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
    row.rookie_saving = row.extension_price - row.player_salary
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
    const current_salary = rows.reduce((sum, row) => sum + row.player_salary, 0)
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
  // Every active-roster contract that could change hands this period: untagged
  // contracts priced against the single-season market, plus the players carrying
  // the restricted-free-agency tag. Three nested sets, each answering a
  // different question, and keeping them distinct is the whole point:
  //
  //   market_pool     — everything a manager might see move.
  //   under_pressure  — priced at least SHED_POOL_MINIMUM_MARKET_GAP above the
  //                     single-season market. A fact about the contract.
  //   releasable      — of those, the ones an owner would plausibly shed. A
  //                     claim about the owner, and the only one that funds
  //                     `capacity`.
  //
  // The pool stays wide on purpose: below-replacement contracts land in it
  // (their market price is at or near zero) and are the easiest releases of all.
  //
  // `under_pressure` was `market_gap > 0 AND pts_added > 0` until 2026-07-30.
  // The second condition tested nothing the first had not: `market_salary` is
  // DERIVED from `pts_added`, so across the live board 0 of 121 rows differed
  // either way. What it did do was drop every young ascending player, because a
  // one-season price cannot separate a rising rookie from a finished veteran —
  // both price at $0. L.Burden III (dynasty 34), R.Odunze (48), B.Thomas (51)
  // and M.Harrison (56) were screened out alongside J.Tonges at −83.9 points.
  //
  // `pts_added` survives as a CONTINUOUS signal rather than a gate, and it is
  // the better one at the low end: `market_salary` clips at exactly $0 for
  // every below-replacement row and carries no ordering there, while
  // `pts_added` still separates −6.9 from −83.9.
  //
  // Two axes, deliberately separate, because one screen was answering both
  // questions badly:
  //
  //   pool_rank  — is he worth acquiring? Dynasty standing WITHIN the supply
  //                pool, so the comparison set is what could become available
  //                rather than the whole league.
  //   market_gap — will his owner let him go? What the contract costs above a
  //                season of the player.
  //
  // RESTRICTED-FREE-AGENCY-TAGGED ROWS BELONG HERE (2026-07-31). They were
  // excluded while the pool was defined as untagged contracts, which left the
  // one pool a manager can actually bid on during the nomination period sitting
  // in a separate table with its own rank scale — two tables answering "who
  // might I acquire" in two different units.
  //
  // THEY CARRY THEIR SALARY AND GAP (2026-07-31, second revision). Both were
  // nulled until a tagged player was nominated, on the reasoning that the
  // auction settles the contract so the current value describes a contract
  // about to be replaced. That withheld public state to avoid implying a
  // private one: `post_deadline_salary` is the contract the owner is carrying
  // TODAY and what a nomination is priced against, and `market_gap` differences
  // it against a published single-season projection. Neither is the settling
  // offer, which is blind under Article IX §2 and never enters this artifact —
  // the boundary is the BID, and nulling the salary never protected it.
  //
  // Nulling them also cost the reader more than it saved: the nomination screen
  // needs a gap, so every tagged row was structurally unscreenable and could
  // never be flagged as fitting the profile it most obviously fits.
  //
  // What tagged rows still do NOT get is `under_pressure` and `releasable`.
  // Those describe a contract its owner might shed for cap relief, and a player
  // whose contract the auction is about to re-settle is not one — he is already
  // moving through a different mechanism. Keeping both false also keeps him out
  // of `contracts_under_pressure` and out of `under_pressure_rows`, so he is
  // listed in incoming supply exactly once, by way of the tagged pool.
  const market_pool_rows = active_rows
    .filter(
      (row) =>
        row.untagged || row.tag === player_tag_types.RESTRICTED_FREE_AGENCY
    )
    .map((row) => {
      const restricted_free_agency =
        row.tag === player_tag_types.RESTRICTED_FREE_AGENCY
      const post_deadline_salary = row.post_deadline_salary
      const market_gap = row.market_gap
      return {
        tid: row.tid,
        // Carried on the row rather than joined page-side: the merged supply
        // table names a team per row, and a render that maps tid to name itself
        // is one more place the two can disagree.
        team_name: team_name_by_tid.get(row.tid),
        pid: row.pid,
        name: row.name,
        pos: row.pos,
        // 'untagged' | 'restricted_free_agency'. The page distinguishes the two
        // visually; nothing else on the board branches on it.
        tag_state: restricted_free_agency
          ? 'restricted_free_agency'
          : 'untagged',
        post_deadline_salary,
        // Auction-horizon price. Present here and nowhere else on the board:
        // this pool describes contracts that could reach a single-season
        // auction, which is the only decision a single-season projection can
        // price. Never carried onto tag_board rows, where differencing it
        // against a franchise price would reconstruct a multi-year surplus.
        projected_market_salary: row.projected_market_salary,
        market_gap,
        projected_points_added: row.projected_points_added,
        below_replacement: row.below_replacement,
        projection_missing: row.projection_missing,
        // Pool 1: priced at least SHED_POOL_MINIMUM_MARKET_GAP above the
        // single-season market. Funds nothing on its own — it is the set the
        // two market bands render.
        under_pressure:
          !restricted_free_agency &&
          market_gap !== null &&
          market_gap >= SHED_POOL_MINIMUM_MARKET_GAP,
        // Pool 2: the subset an owner would plausibly shed, because the market
        // prices him at RELEASABLE_MARKET_PRICE_RATIO or less of the contract
        // and an auction could return him for less than it costs today. THIS is
        // what funds `capacity`; `under_pressure` no longer does.
        releasable:
          !restricted_free_agency &&
          market_gap !== null &&
          market_gap >= SHED_POOL_MINIMUM_MARKET_GAP &&
          row.projected_market_salary <=
            RELEASABLE_MARKET_PRICE_RATIO * post_deadline_salary,
        dynasty_value: row.dynasty_value,
        dynasty_rank: row.dynasty_rank,
        dynasty_band: row.dynasty_band,
        rank_precision: row.rank_precision,
        no_market_value: row.no_market_value
      }
    })

  // Standing within the SUPPLY pool — the shed pool plus the tagged players
  // heading to auction, which together are everything that could change hands
  // this period. Ranking the two separately is what forced the page to run two
  // rank scales side by side and caption which was which. A row carrying no
  // dynasty value is ranked nowhere and annotated instead — coverage never
  // suppresses.
  const supply_pool = market_pool_rows.filter(
    (row) => row.under_pressure || row.tag_state === 'restricted_free_agency'
  )
  const supply_pool_ranked = supply_pool.filter(
    (row) => row.dynasty_value !== null
  )
  const supply_pool_size = supply_pool_ranked.length
  const supply_pool_ranks = assign_ranks(
    supply_pool_ranked,
    (row) => row.dynasty_value
  )

  const market_pool = market_pool_rows
    .map(({ dynasty_value, ...row }) => ({
      ...row,
      pool_rank: supply_pool_ranks.get(row.pid) ?? null,
      pool_size: supply_pool_size,
      // Precision is reported the same way as the league-wide dynasty rank and
      // off the same coverage score: narrowing the comparison set does not make
      // a thin-coverage player's neighbours any less noisy, so a row the board
      // will not rank precisely league-wide is banded within the pool too.
      pool_band: band_for_rank(
        supply_pool_ranks.get(row.pid) ?? null,
        supply_pool_size
      ),
      // Both threshold conditions above, and nothing else. This is a PROFILE
      // flag — the contract fits what a nomination is for — not a statement
      // that the owner may still designate one. It used to carry the tag-budget
      // gate as a third condition, which was meaningful only while the
      // designation window was open: the restricted-free-agency tag is applied
      // BEFORE the extension deadline (`api/routes/teams/tag.mjs` refuses every
      // tag once `extension_deadline_at` passes) and the nomination schedule then governs
      // when an already-tagged player is announced. Carrying the gate past the
      // deadline would empty the flag on every roster in the league, which is
      // the one thing it must not do — who fits the profile is exactly what a
      // manager reviews when the window is closed. Who is actually going to
      // auction is `tag_state`, which reads the roster tag.
      //
      // A TAGGED ROW CAN CARRY THIS FLAG (2026-07-31, second revision). It could
      // not while its salary and gap were nulled, which made every tagged row
      // structurally unscreenable — the players most obviously in the
      // restricted-free-agency pool were the only ones the pool flag could never
      // describe. Now that they carry both fields they are screened like any
      // other contract, and those that fit are in the pool and shaded with it.
      //
      // The flag reads "fits the profile a nomination is for", across the whole
      // pool. It does NOT read "untagged and fits the profile", and it is not a
      // statement that the owner may still designate one — though as of
      // 2026-07-31 he generally may, since `restricted-free-agency.mjs` carries
      // no `extension_deadline_at` guard and designations stay open to the period end.
      //
      // The `under_pressure` precondition was dropped with the same change and
      // was always redundant: the nomination minimum gap ($6) is strictly above
      // the shed-pool minimum ($3), so any row clearing the first cleared the
      // second. All it did was inherit the shed pool's tagged-row exclusion.
      //
      // A row with no projection is never marked. It is unscreenable on the
      // replacement condition rather than failing it, and coverage annotates
      // rather than suppresses — the row keeps its place in the table.
      rfa_nomination_target:
        row.market_gap !== null &&
        row.market_gap >=
          RESTRICTED_FREE_AGENCY_NOMINATION_MINIMUM_MARKET_GAP &&
        row.projected_points_added !== null &&
        row.projected_points_added >=
          RESTRICTED_FREE_AGENCY_NOMINATION_REPLACEMENT_FLOOR_POINTS
    }))
    // Widest gap first; a row with no gap — unscreenable, or tagged and awaiting
    // the auction — sorts last rather than dropping out, ordered among itself by
    // market price so the artifact is deterministic. Render ORDER is owned by
    // `market_bands`; this sort only makes the flat pool stable.
    .sort((a, b) => {
      if (a.market_gap === null || b.market_gap === null) {
        if (a.market_gap !== null) return -1
        if (b.market_gap !== null) return 1
        return (
          (b.projected_market_salary ?? -1) - (a.projected_market_salary ?? -1)
        )
      }
      return b.market_gap - a.market_gap
    })

  const market_pool_by_tid = new Map(team_ids.map((tid) => [tid, []]))
  for (const row of market_pool) {
    market_pool_by_tid.get(row.tid)?.push(row)
  }

  // ---- restricted free agency pool ----------------------------------------
  //
  // Every player carrying the restricted-free-agency tag, league-wide: the
  // supply that actually reaches the auction during the nomination period.
  //
  // An ordered list of pids into `market_pool`, not a second copy of the rows.
  // Until 2026-07-31 it WAS a second copy, because tagged players were excluded
  // from `market_pool` — which meant two sets of rows for the same players, with
  // different field sets and their own rank scale, and a page that had to run
  // two tables to show one question. Now the rows live in the pool like any
  // other supply and this names which of them carry the tag, in the order the
  // auction table wants them: most expensive season first.
  //
  // Those rows carry no salary by construction (see the pool above). What a
  // bidder can act on is the single-season price and the player's standing in
  // the supply pool, both public state computed identically for all ten
  // franchises.
  const restricted_free_agency_pool_rows = market_pool
    .filter((row) => row.tag_state === 'restricted_free_agency')
    // Most expensive season first; an unpriced row sorts last rather than
    // dropping out.
    .sort((a, b) => {
      if (a.projected_market_salary === null) {
        return b.projected_market_salary === null ? 0 : 1
      }
      if (b.projected_market_salary === null) return -1
      return b.projected_market_salary - a.projected_market_salary
    })

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
          player_salary: row.player_salary,
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
    // substitute for private shed intent is the RELEASABLE pool.
    //
    // It is `releasable`, not `under_pressure` — the two were the same set until
    // 2026-07-31 and are now deliberately different. "Priced above the market"
    // is a fact about a contract; "releasable" is a claim about what its owner
    // would do, and only the second belongs in a figure a manager reads as
    // spending power. Summing the wider set credited every franchise with money
    // it would never free: Gråkappan's $79 counted $18 for B.Bowers at a $2 gap,
    // the second-ranked player in the entire pool. The narrowing costs the
    // league $311 of paper capacity and moves three franchises negative, which
    // is the honest reading — $133 over with $121 you would actually shed means
    // you cannot reach compliance without cutting someone you want.
    const attachable_rows = market_pool_by_tid
      .get(tid)
      .filter((row) => row.releasable)
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

  // ---- market bands -------------------------------------------------------
  //
  // Membership and ORDER for the three sets the page renders, declared here
  // rather than re-derived by each render. They are ordered lists of pids into
  // `market_pool`, not copies of the rows: one source of truth for the row
  // data, so a band and the pool cannot drift apart, and a 218KB artifact does
  // not triple.
  //
  // The render errors these exist to remove are membership and ordering, not
  // arithmetic — a page that filters `market_pool` itself is re-implementing a
  // screen it has already been given, which is how a tagged player lingered in
  // incoming supply and how the shed pool got rendered as contracts under
  // pressure. The checker gates on these lists for the same reason.
  const by_gap_desc = (rows) =>
    [...rows].sort((a, b) => {
      if (a.market_gap === null) return b.market_gap === null ? 0 : 1
      if (b.market_gap === null) return -1
      if (b.market_gap !== a.market_gap) return b.market_gap - a.market_gap
      return a.pid < b.pid ? -1 : 1
    })

  const under_pressure_rows = market_pool.filter((row) => row.under_pressure)

  // Grouped by position, ordered by MARKET PRICE descending within each — one
  // scale over the whole position, tagged and shed-pool rows interleaved.
  //
  // It was tagged-first-then-widest-gap until 2026-07-31. Tagged rows led
  // because they carried no gap and would otherwise have sorted to the bottom,
  // which made the order a consequence of a null rather than a judgement. They
  // carry a gap now, so that reason is gone, and market price is the better key
  // regardless: the band answers "what could I acquire", and the reader is
  // scanning for the best player available at a position, not for whose owner is
  // most overpaying. The gap belongs to the owner's decision; the price is the
  // bidder's. A null price sorts last.
  //
  // Ties break on the widest gap, then on pid for determinism. The tie-break is
  // load-bearing rather than cosmetic: `projected_market_salary` clips at $0, so
  // whole positions pile up there — 8 of 11 tight ends on the live board — and
  // an alphabetical tie-break scatters the flagged rows through the unflagged
  // ones for no reason a reader can see, putting a $5 contract above a $25 one
  // that fits the nomination profile. The gap is the only field that still
  // orders rows the price has flattened.
  const by_market_price_desc = (rows) =>
    [...rows].sort((a, b) => {
      const a_price = a.projected_market_salary
      const b_price = b.projected_market_salary
      if (a_price === null || b_price === null) {
        if (a_price !== null) return -1
        if (b_price !== null) return 1
      } else if (b_price !== a_price) {
        return b_price - a_price
      }
      const a_gap = a.market_gap ?? -Infinity
      const b_gap = b.market_gap ?? -Infinity
      if (b_gap !== a_gap) return b_gap - a_gap
      return a.pid < b.pid ? -1 : 1
    })

  const incoming_supply_by_position = {}
  for (const row of by_market_price_desc([
    ...restricted_free_agency_pool_rows,
    ...under_pressure_rows
  ])) {
    ;(incoming_supply_by_position[row.pos] ||= []).push(row.pid)
  }

  const market_bands = {
    // This viewer's own rows. Absent when the board is built league-wide with
    // no viewer, rather than silently empty.
    contracts_under_pressure:
      viewer_tid === null
        ? null
        : by_gap_desc(
            under_pressure_rows.filter((row) => row.tid === viewer_tid)
          ).map((row) => row.pid),
    incoming_supply: incoming_supply_by_position,
    // Who actually carries the tag, league-wide, most expensive season first.
    // A subset of incoming_supply rather than a separate table's contents: the
    // page marks these rows in place.
    restricted_free_agency_pool: restricted_free_agency_pool_rows.map(
      (row) => row.pid
    ),
    // This viewer's own tagged players — what THIS franchise is sending to
    // auction. Absent, not empty, when built with no viewer.
    restricted_free_agency_tagged:
      viewer_tid === null
        ? null
        : restricted_free_agency_pool_rows
            .filter((row) => row.tid === viewer_tid)
            .map((row) => row.pid),
    // The daggered subset. A strict subset of incoming supply, carried
    // separately because it is the set a manager acts on, and scanning the
    // whole pool for a flag is not the same as being handed the candidates.
    rfa_nomination_pool: by_gap_desc(
      market_pool.filter((row) => row.rfa_nomination_target)
    ).map((row) => row.pid),
    // This viewer's own rows that fit the nomination profile and are NOT
    // already tagged — the "which of my players could I still nominate"
    // question, handed over rather than left to a page to intersect two bands.
    // Absent, not empty, when built with no viewer.
    //
    // The tag-state exclusion is this band's alone and does not belong on the
    // flag. Since 2026-07-31 a tagged row can carry `rfa_nomination_target`,
    // which is what puts it in the league-wide pool the supply table shades —
    // but the restricted free agency band already names this viewer's tagged
    // players one list above, so admitting them here would print the same
    // players twice in the same band, under a heading that reads as an action
    // still available on a player who has already had it taken.
    rfa_nomination_candidates:
      viewer_tid === null
        ? null
        : by_gap_desc(
            market_pool.filter(
              (row) =>
                row.rfa_nomination_target &&
                row.tag_state !== 'restricted_free_agency' &&
                row.tid === viewer_tid
            )
          ).map((row) => row.pid)
  }

  // Derived from the band rather than counted independently, so the headline
  // count and the named rows under it cannot disagree.
  const incoming_supply = Object.fromEntries(
    Object.entries(incoming_supply_by_position).map(([pos, pids]) => [
      pos,
      pids.length
    ])
  )

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
    // The auction supply itself: how many tagged players each franchise sends,
    // counted from the roster tag rather than from a screen. A team absent from
    // `by_tid` designated nobody before the deadline and enters the period as a
    // bidder only.
    restricted_free_agency_auction: {
      total: restricted_free_agency_pool_rows.length,
      by_tid: team_ids
        .map((tid) => ({
          tid,
          count: restricted_free_agency_pool_rows.filter(
            (row) => row.tid === tid
          ).length
        }))
        .filter((row) => row.count > 0)
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
      restricted_free_agency_pool: restricted_free_agency_pool_rows,
      extensions_processed,
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
      tid: team.team_id,
      name: team.name,
      draft_order: team.draft_order
    })),
    cap_exposure,
    tag_board,
    tag_budget,
    bid_capacity,
    market_pool,
    market_bands,
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
  // timestamptz column; the day-stepping below is epoch seconds. Left as a Date
  // it would string-concatenate rather than add, and Date.toISOString would
  // throw RangeError on the result.
  const start = timestamptz_to_epoch(season.restricted_free_agency_period_start)
  if (!start) return []

  const sorted = [...teams].sort(
    (a, b) => (b.draft_order || 0) - (a.draft_order || 0)
  )
  const turns = season.restricted_free_agency_tag_limit || 2

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
      tid: team.team_id,
      name: team.name,
      draft_order: team.draft_order,
      nomination_position: index + 1,
      windows
    }
  })
}

const CALENDAR_EVENTS = [
  ['Extension Deadline', 'extension_deadline_at'],
  ['Restricted Free Agency Begins', 'restricted_free_agency_period_start'],
  ['Restricted Free Agency Ends', 'restricted_free_agency_period_end'],
  ['Rookie Draft', 'draft_start'],
  ['Free Agency Period Begins', 'free_agency_period_start'],
  ['Free Agency Auction Begins', 'free_agency_live_auction_start'],
  ['Free Agency Auction Ends', 'free_agency_live_auction_end'],
  ['Free Agency Period Ends', 'free_agency_period_end'],
  ['Trade Deadline', 'trade_deadline_at']
]

/**
 * Deadlines are read from the `seasons` row at computation time and stamped
 * with that read. The seeded pages went stale silently when the commissioner
 * moved a date, so a consumer can compare `read_at` against its own clock.
 */
export const build_calendar_freshness = ({ season, now_unix }) => {
  const calendar = CALENDAR_EVENTS.map(([label, field]) => {
    // Every field in CALENDAR_EVENTS is a `seasons` timestamptz column, so it
    // arrives as a Date; the arithmetic below is epoch seconds.
    const at = timestamptz_to_epoch(season[field])
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
  restricted_free_agency_pool = [],
  extensions_processed = false,
  now_unix,
  season,
  team_count
}) => {
  const fired = []
  const overage =
    exposure.post_extension_room < 0 ? -exposure.post_extension_room : 0

  // The franchise and rookie tags are extension-window designations: the tag
  // route refuses every application once `extension_deadline_at` passes, and by then the
  // ladder has already been applied. Every rule below that reasons about them
  // is therefore gated on the window still being open, or it fires post-deadline
  // stating a lever that does not exist — "your remaining tags can remove at
  // most $0" reads as advice about a decision that closed.
  const designation_window_open = !extensions_processed

  // Lever sufficiency
  if (designation_window_open && overage > 0) {
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
  if (
    designation_window_open &&
    budget.franchise.remaining > 0 &&
    franchise_candidates.length === 0
  ) {
    const rivals = league_market.teams_with_franchise_candidate.filter(
      (other) => other !== tid
    )
    fired.push({
      rule: 'empty_screen',
      sentence: `No contract on your active roster prices above its position's franchise amount, so the franchise tag has no application for you this year. ${rivals.length} of the other ${team_count - 1} teams hold an eligible candidate and still have the tag to spend.`,
      inputs: { tag: 'franchise', rival_count: rivals.length, rivals }
    })
  }
  if (
    designation_window_open &&
    budget.rookie.remaining > 0 &&
    rookie_candidates.length === 0
  ) {
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
  if (
    designation_window_open &&
    budget.franchise.remaining > 0 &&
    franchise_candidates.length > 1
  ) {
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

  // Your nomination windows. Fires from the extension deadline through the end
  // of the period rather than only inside it: the turns are fixed by draft
  // order and knowable in advance, and the days before the period opens are
  // exactly when a manager plans against them.
  if (rfa_window && rfa_window.windows.length) {
    const period_open =
      season.restricted_free_agency_period_end &&
      now_unix <= timestamptz_to_epoch(season.restricted_free_agency_period_end)
    if (period_open) {
      fired.push({
        rule: 'nomination_windows',
        sentence: `Your ${rfa_window.windows.length} restricted free agency nomination turns fall on ${rfa_window.windows.map((w) => w.at_iso.slice(0, 10)).join(' and ')}, fixed by descending draft order.`,
        inputs: rfa_window
      })
    }
  }

  // The auction supply itself. Distinct from incoming_supply below, which is
  // the shed pool — a forecast of what MIGHT become available. This one is
  // settled: these players carry the tag and go to auction.
  if (restricted_free_agency_pool.length) {
    const own = restricted_free_agency_pool.filter((row) => row.tid === tid)
    const owning_teams = new Set(
      restricted_free_agency_pool.map((row) => row.tid)
    )
    fired.push({
      rule: 'restricted_free_agency_auction_pool',
      sentence: own.length
        ? `${restricted_free_agency_pool.length} players across ${owning_teams.size} franchises carry the restricted free agency tag, ${own.length} of them yours: ${own.map((row) => row.name).join(', ')}.`
        : `${restricted_free_agency_pool.length} players across ${owning_teams.size} franchises carry the restricted free agency tag, none of them yours, so you enter the period as a bidder only.`,
      inputs: {
        total: restricted_free_agency_pool.length,
        owning_team_count: owning_teams.size,
        own_pids: own.map((row) => row.pid)
      }
    })
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
        ? `After extensions you hold $${capacity.cap_room} of room, and shedding your ${capacity.attachable_contract_count} contracts the market prices well below what you pay would take that to $${capacity.capacity}.`
        : `After extensions you are $${-capacity.cap_room} over the cap, and shedding your ${capacity.attachable_contract_count} contracts the market prices well below what you pay would move you to $${capacity.capacity}.`,
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
      sentence: `Shedding every contract you could plausibly release still leaves you $${-capacity.capacity} over the cap, so reaching compliance means cutting a contract the market rates at what you pay.`,
      inputs: { capacity: capacity.capacity }
    })
  }

  // Contracts under pressure
  if (team_market_pool.some((row) => row.under_pressure)) {
    const rows = team_market_pool.filter((row) => row.under_pressure)
    const total_gap = rows.reduce((sum, row) => sum + row.market_gap, 0)
    fired.push({
      rule: 'contracts_under_pressure',
      sentence: `${rows.length} of your untagged contracts cost more than a season of the player prices at, $${total_gap} above the market in total.`,
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
      sentence: `League-wide, ${supply_entries.map(([pos, n]) => `${n} ${pos}`).join(', ')} players could change hands this period — the tagged players heading to auction plus every contract priced above a season of the player.`,
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
