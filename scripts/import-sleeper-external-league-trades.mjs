import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { is_main, report_job, batch_insert } from '#libs-server'
import { job_types } from '#libs-shared/job-constants.mjs'
import { current_season } from '#constants'
import {
  parse_sleeper_league,
  parse_sleeper_league_member_users,
  parse_sleeper_transactions,
  parse_sleeper_user_leagues,
  sleeper_transaction_buckets_to_fetch
} from '#libs-server/external-league-trades/sleeper-trade-parser.mjs'

const log = debug('import-sleeper-external-league-trades')
debug.enable('import-sleeper-external-league-trades')

const argv = yargs(hideBin(process.argv)).argv

const SLEEPER_API_URL = 'https://api.sleeper.app/v1'

// Sleeper documents a ~1000 req/min ceiling before IP blocking, and a
// third-party source reports 90/min. We target 60/min, comfortably under both.
// This is a background enrichment job with no deadline, so being cheap and
// polite is worth more than finishing sooner.
//
// PACED AGAINST ELAPSED TIME, NOT A FIXED SLEEP BETWEEN REQUESTS. A fixed sleep
// does not control a rate -- it ADDS to network latency, so the achieved rate
// depends entirely on where the job runs, and the fast host is the one that
// ships. Measured 2026-07-29 with the previous fixed 120ms sleep: round trip to
// Sleeper was ~670ms from a workstation (~76 req/min actual) but ~43ms from the
// production VPS, which would have run the identical code at ~350 req/min --
// nearly 4x the conservative published figure. Worse, the workstation
// measurement looked reassuring and was pure artifact of a slow link. Enforcing
// a floor on the interval between request STARTS makes the rate the same
// everywhere and independent of how fast the upstream answers.
const MIN_REQUEST_INTERVAL_MS = 1000

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// Timestamp the next request is allowed to START. Advancing it from
// max(now, next_request_at) rather than from `now` means a slow response does
// not "bank" credit toward firing a burst afterwards, while an idle gap does
// not push the schedule into the past.
let next_request_at = 0

const throttle_request = async () => {
  const now = Date.now()
  const wait_ms = next_request_at - now
  if (wait_ms > 0) {
    await sleep(wait_ms)
  }
  next_request_at = Math.max(now, next_request_at) + MIN_REQUEST_INTERVAL_MS
}

// Counted per stage rather than in one total, because the whole point of
// persisting the crawl graph is that repeated runs spend their requests on NEW
// work instead of re-deriving what is already known. A run whose crawl cost is
// climbing while its new-league count is flat is a run that has started
// re-walking, and only a per-stage count makes that visible.
const request_counts = { crawl: 0, import: 0 }
let request_stage = 'import'

const sleeper_get = async (path) => {
  await throttle_request()
  request_counts[request_stage] += 1

  const res = await fetch(`${SLEEPER_API_URL}${path}`)

  // Sleeper returns 404 with a null body for leagues that have been deleted or
  // made private. That is an expected outcome of crawling a frontier, not a
  // failure, so it yields null and the caller skips.
  if (res.status === 404) {
    return null
  }

  if (!res.ok) {
    throw new Error(`sleeper ${path} responded ${res.status}`)
  }

  return res.json()
}

/**
 * Resolve Sleeper player ids to internal pids in one query.
 *
 * Direct sleeper_player_id join only -- no name/position fallback. Measured
 * match rate on real traded skill players was 176/176, so a fallback would add
 * a fuzzy-match failure mode to buy approximately nothing. Unresolved ids are
 * returned as null pids and stored that way, which makes a future regression
 * countable via idx_external_league_trade_legs_unresolved.
 *
 * Team defenses are the one exception, and they are still not fuzzy. Sleeper
 * identifies a DEF by bare team abbreviation ('PHI'), our DST pids ARE the bare
 * team abbreviation, and no DST row carries a sleeper_player_id -- all 32 are
 * null -- so the join above cannot match them and every traded defense would
 * land unresolved. The mapping is an exact identity, so it is resolved as one.
 */
const resolve_player_ids = async (external_player_ids) => {
  if (!external_player_ids.length) {
    return new Map()
  }

  const rows = await db('player')
    .select('pid', 'sleeper_player_id')
    .whereIn('sleeper_player_id', external_player_ids)

  const pid_by_external_id = new Map(
    rows.map((row) => [String(row.sleeper_player_id), row.pid])
  )

  const unmatched = external_player_ids.filter(
    (id) => !pid_by_external_id.has(id)
  )

  if (unmatched.length) {
    const dst_rows = await db('player')
      .select('pid')
      .where({ primary_position: 'DST' })
      .whereIn('pid', unmatched)

    for (const row of dst_rows) {
      pid_by_external_id.set(row.pid, row.pid)
    }
  }

  return pid_by_external_id
}

/**
 * Import every completed trade from one Sleeper league-season.
 * @returns {Promise<Object>} Per-league import counts
 */
export const import_sleeper_league_trades = async ({
  external_league_id,
  discovered_via = null,
  dry_run = false
}) => {
  const league = await sleeper_get(`/league/${external_league_id}`)
  if (!league) {
    log(`league ${external_league_id} unavailable, skipping`)
    return { skipped: true, trades: 0, legs: 0, unresolved: 0 }
  }

  const league_row = parse_sleeper_league({ league, discovered_via })
  if (!league_row) {
    log(`league ${external_league_id} has unusable format metadata, skipping`)
    return { skipped: true, trades: 0, legs: 0, unresolved: 0 }
  }

  // Bounded by the current week rather than fixed at 18: a season in progress
  // cannot have filed transactions under weeks that have not happened yet. See
  // sleeper_transaction_buckets_to_fetch -- this turns a 19-request import into
  // a 2-request one for most of the corpus.
  const buckets = sleeper_transaction_buckets_to_fetch({
    league_season_year: league_row.season_year,
    current_season_year: current_season.year,
    current_season_week: current_season.week
  })

  const parsed_trades = []
  for (const bucket of buckets) {
    const transactions = await sleeper_get(
      `/league/${external_league_id}/transactions/${bucket}`
    )

    parsed_trades.push(
      ...parse_sleeper_transactions({
        transactions,
        external_league_id,
        season_year: league_row.season_year,
        platform_transaction_bucket: bucket
      })
    )
  }

  const all_legs = parsed_trades.flatMap((entry) => entry.legs)
  const external_player_ids = [
    ...new Set(
      all_legs
        .filter((leg) => leg.leg_type === 'player')
        .map((leg) => leg.external_player_id)
    )
  ]

  const pid_by_external_id = await resolve_player_ids(external_player_ids)

  let unresolved = 0
  for (const leg of all_legs) {
    if (leg.leg_type !== 'player') {
      continue
    }
    leg.pid = pid_by_external_id.get(leg.external_player_id) || null
    if (!leg.pid) {
      unresolved += 1
    }
  }

  if (dry_run) {
    log(
      `[dry] ${external_league_id} (${league_row.league_format}${league_row.is_superflex ? ' superflex' : ''}): ${parsed_trades.length} trades, ${all_legs.length} legs, ${unresolved} unresolved`
    )
    return {
      skipped: false,
      trades: parsed_trades.length,
      legs: all_legs.length,
      unresolved,
      league_row
    }
  }

  await upsert_league_nodes({
    league_rows: [{ ...league_row, last_synced_at: new Date() }],
    // The only caller that may advance last_synced_at, because it is the only
    // one that actually read the league's trades.
    is_import: true
  })

  if (parsed_trades.length) {
    // Trades are immutable once complete, so a re-run should be a no-op rather
    // than a duplicate-key failure -- this job is expected to run repeatedly
    // over the same leagues as new trades appear.
    await batch_insert({
      items: parsed_trades.map((entry) => entry.trade),
      batch_size: 500,
      save: (batch) =>
        db('external_league_trades')
          .insert(batch)
          .onConflict(['platform', 'external_transaction_id'])
          .ignore()
    })

    await batch_insert({
      items: all_legs,
      batch_size: 500,
      save: (batch) =>
        db('external_league_trade_legs')
          .insert(batch)
          .onConflict(['platform', 'external_transaction_id', 'leg_index'])
          .merge()
    })
  }

  log(
    `${external_league_id} (${league_row.league_format}${league_row.is_superflex ? ' superflex' : ''}): ${parsed_trades.length} trades, ${all_legs.length} legs, ${unresolved} unresolved`
  )

  return {
    skipped: false,
    trades: parsed_trades.length,
    legs: all_legs.length,
    unresolved,
    league_row
  }
}

// Columns the import stage is allowed to refresh on an existing league node.
// Everything about how the league was DISCOVERED is first-write-wins and is
// absent from this list on purpose.
const LEAGUE_REFRESH_COLUMNS = [
  'season_year',
  'league_name',
  'num_teams',
  'league_format',
  'is_superflex',
  'is_best_ball',
  'points_per_reception',
  'tight_end_premium',
  'passing_touchdown_points',
  'taxi_slots',
  'roster_positions',
  'scoring_settings',
  'previous_external_league_id',
  // Refreshed like the rest of the format metadata. league_status and
  // last_message_at in particular are the fields most worth having CURRENT --
  // a league that was pre_draft when first crawled and is in_season now is
  // exactly the state change a later selection rule cares about.
  'league_status',
  'last_message_at',
  'external_draft_id',
  'league_settings',
  'league_metadata'
]

// last_synced_at is the IMPORT CURSOR and is deliberately not in the list above,
// because merging it from the crawl would be actively destructive rather than
// merely redundant. `merge([col])` compiles to `SET col = excluded.col`, and the
// crawl's rows have no last_synced_at key at all, so excluded.last_synced_at is
// null -- every re-sighting of an already-imported league would reset it to
// never-imported and put the league back on the import backlog forever.
const IMPORT_REFRESH_COLUMNS = [...LEAGUE_REFRESH_COLUMNS, 'last_synced_at']

/**
 * Persist league graph nodes.
 *
 * Both callers refresh the descriptive columns and neither touches the discovery
 * columns, which are first-write-wins: the crawl tree is what makes the sampling
 * bias measurable, and the import stage does not know how the league was reached.
 *
 * The crawl used to ignore conflicts outright, which threw away good data for no
 * reason -- /user/{id}/leagues returns FULL league objects, so a re-sighting
 * carries metadata at least as fresh as what is stored. That mattered little
 * while the row was just format fields, and matters a lot now that it carries
 * league_status and last_message_at: under `ignore`, the 3,620 leagues already in
 * the graph could never acquire the newly-captured fields at all, because the
 * only path that would refresh them is the import stage and imports are paused.
 */
const upsert_league_nodes = async ({ league_rows, is_import }) => {
  if (!league_rows.length) {
    return
  }

  await batch_insert({
    items: league_rows,
    batch_size: 500,
    save: (batch) =>
      db('external_leagues')
        .insert(batch)
        .onConflict(['platform', 'external_league_id'])
        .merge(is_import ? IMPORT_REFRESH_COLUMNS : LEAGUE_REFRESH_COLUMNS)
  })
}

const upsert_user_nodes = async (user_rows) => {
  if (!user_rows.length) {
    return
  }

  await batch_insert({
    items: user_rows,
    batch_size: 500,
    save: (batch) =>
      db('external_league_users')
        .insert(batch)
        .onConflict(['platform', 'external_user_id'])
        // Only the descriptive columns are merged. last_crawled_at and
        // first_seen_at are cursors that live on this row, and re-seeing a
        // manager in another league must never reset them -- merging
        // last_crawled_at would hand back a null (the crawl's rows do not carry
        // it), marking every re-seen manager unexplored and sending the crawl
        // around its own history forever.
        .merge(['display_name', 'is_bot'])
  })
}

/**
 * Persist league <-> manager edges.
 *
 * merge_is_owner is false for the manager -> leagues direction, which yields the
 * edge but never says who owns the team. Merging is_owner from there would
 * overwrite a known true with a null, because the column is simply absent from
 * those rows -- so only the member-list path, which actually reads it, is
 * allowed to write it.
 */
const upsert_membership_edges = async (
  memberships,
  { merge_is_owner = false } = {}
) => {
  if (!memberships.length) {
    return
  }

  await batch_insert({
    items: memberships,
    batch_size: 500,
    save: (batch) => {
      const query = db('external_league_memberships')
        .insert(batch)
        .onConflict(['platform', 'external_league_id', 'external_user_id'])

      return merge_is_owner ? query.merge(['is_owner']) : query.ignore()
    }
  })
}

/**
 * Fetch a seed league and persist it as a graph node.
 *
 * The seed is a BOOTSTRAP, not a permanent anchor: it is only consulted when
 * the persisted graph offers no frontier at all, which in practice means the
 * very first run. Every run after that resumes from persisted state and the
 * seed argument is inert.
 */
const bootstrap_seed_leagues = async (seed_league_ids) => {
  const league_rows = []

  for (const seed_league_id of seed_league_ids) {
    const league = await sleeper_get(`/league/${seed_league_id}`)
    const league_row = parse_sleeper_league({ league, discovered_via: 'seed' })

    if (!league_row) {
      log(`seed league ${seed_league_id} unusable, skipping`)
      continue
    }

    league_rows.push(league_row)
  }

  await upsert_league_nodes({ league_rows, is_import: false })

  return league_rows.length
}

/**
 * Expand one league into its member managers.
 *
 * This is the half of the crawl that produces new FRONTIER USERS. It costs one
 * request and is recorded as done via member_list_crawled_at, so no later run
 * pays for it again.
 */
const crawl_league_member_list = async (external_league_id) => {
  const payload = await sleeper_get(`/league/${external_league_id}/users`)

  // A 404 here is a deleted or privatised league, which is a permanent state,
  // not a transient one. Marking it crawled anyway is what stops every future
  // run from re-requesting the same dead league forever.
  const { users, memberships } = parse_sleeper_league_member_users({
    users: payload,
    external_league_id
  })

  await upsert_user_nodes(users)
  // The only path that reads is_owner, so the only one allowed to write it.
  await upsert_membership_edges(memberships, { merge_is_owner: true })

  await db('external_leagues')
    .where({ platform: 'sleeper', external_league_id })
    .update({ member_list_crawled_at: new Date() })

  return users.length
}

/**
 * Expand one manager into the leagues they play in.
 *
 * This is the half of the crawl that produces new LEAGUES, and it is the
 * expensive edge: one request buys every league that manager is in for the
 * season, and those edges are exactly what was being thrown away before.
 *
 * @returns {Promise<number>} Count of leagues new to the graph. Deliberately
 *   NOT filtered by the import appetite: crawling is cheap and importing is
 *   not, so the map is allowed to run ahead of what we currently want to read.
 */
const crawl_user_leagues = async ({ external_user_id, season_year }) => {
  const payload = await sleeper_get(
    `/user/${external_user_id}/leagues/nfl/${season_year}`
  )

  const { leagues, memberships } = parse_sleeper_user_leagues({
    leagues: payload,
    external_user_id
  })

  const external_league_ids = leagues.map((row) => row.external_league_id)

  const already_known = external_league_ids.length
    ? await db('external_leagues')
        .select('external_league_id')
        .where({ platform: 'sleeper' })
        .whereIn('external_league_id', external_league_ids)
    : []
  const known_ids = new Set(already_known.map((row) => row.external_league_id))

  // Every discovered league is persisted, including formats the current
  // appetite does not want. The payload is already in hand, so the row is free,
  // and a league recorded once is never rediscovered -- a later run that widens
  // its appetite reads them from the graph instead of re-crawling for them.
  await upsert_league_nodes({
    league_rows: leagues,
    is_import: false
  })
  await upsert_membership_edges(memberships)

  await db('external_league_users')
    .where({ platform: 'sleeper', external_user_id })
    .update({ last_crawled_at: new Date() })

  return leagues.filter((row) => !known_ids.has(row.external_league_id)).length
}

/**
 * Extend the persisted crawl graph by new_league_limit leagues.
 *
 * Sleeper has no "list public leagues" endpoint, but the graph is traversable:
 * /league/{id}/users gives every member's user_id, and
 * /user/{user_id}/leagues/nfl/{season} gives every league that user is in. All
 * of it is public read-only data and no membership is required.
 *
 * The graph is PERSISTED, which is what makes the frontier resumable. Two
 * null-valued timestamps define it -- external_league_users.last_crawled_at for
 * managers never expanded, external_leagues.member_list_crawled_at for leagues
 * whose member list was never read -- so a run starts from wherever the last
 * one stopped instead of re-walking from the seed. Managers are expanded before
 * league member lists because manager expansion is the step that yields new
 * leagues; reading a member list only replenishes the supply of managers.
 *
 * Note this biases toward leagues whose managers play in many leagues. The
 * membership edges plus external_leagues.discovered_from_external_user_id
 * record the crawl tree, so the bias is measurable after the fact rather than
 * baked in invisibly.
 */
export const crawl_sleeper_league_graph = async ({
  seed_league_ids = [],
  season_year = current_season.year,
  new_league_limit,
  max_runtime_minutes = null
}) => {
  const previous_stage = request_stage
  request_stage = 'crawl'

  let new_leagues = 0
  let users_expanded = 0
  let member_lists_crawled = 0
  let bootstrapped = false
  let stopped_on_time = false

  // The league budget alone does not bound wall clock, because it is denominated
  // in the OUTPUT of a request while the rate limit prices the INPUT. Yield per
  // request is measured at ~5 new leagues now, but it falls as the graph
  // saturates and the same budget then costs several times longer -- at a yield
  // of 1, a 20,000-league budget is 20,000 requests, which at 60/min is over two
  // weeks and would still be running when the next run starts. A deadline is the
  // only bound that holds regardless of yield, so time is the intended binding
  // constraint and the league budget is the safety ceiling above it.
  const deadline_at = max_runtime_minutes
    ? Date.now() + max_runtime_minutes * 60 * 1000
    : null

  try {
    while (new_leagues < new_league_limit) {
      if (deadline_at && Date.now() >= deadline_at) {
        stopped_on_time = true
        break
      }

      const frontier_user = await db('external_league_users')
        .select('external_user_id')
        .where({ platform: 'sleeper' })
        .whereNull('last_crawled_at')
        .orderBy('first_seen_at', 'asc')
        .first()

      if (frontier_user) {
        new_leagues += await crawl_user_leagues({
          external_user_id: frontier_user.external_user_id,
          season_year
        })
        users_expanded += 1
        continue
      }

      const frontier_league = await db('external_leagues')
        .select('external_league_id')
        .where({ platform: 'sleeper' })
        .whereNull('member_list_crawled_at')
        .orderBy('created_at', 'asc')
        .first()

      if (frontier_league) {
        await crawl_league_member_list(frontier_league.external_league_id)
        member_lists_crawled += 1
        continue
      }

      // No frontier on either side. Only now does the seed matter, and only
      // once per run -- re-running the bootstrap against an exhausted graph
      // would spin without ever producing a new node.
      if (bootstrapped || !seed_league_ids.length) {
        log('crawl graph fully explored, no frontier remains')
        break
      }

      bootstrapped = true
      const seeded = await bootstrap_seed_leagues(seed_league_ids)
      if (!seeded) {
        break
      }
    }
  } finally {
    request_stage = previous_stage
  }

  log(
    `crawl: ${new_leagues} new leagues from ${users_expanded} managers expanded and ${member_lists_crawled} member lists read (${request_counts.crawl} requests)${stopped_on_time ? `, stopped on the ${max_runtime_minutes}m deadline` : ''}`
  )

  return { new_leagues, users_expanded, member_lists_crawled, stopped_on_time }
}

/**
 * Derive the import appetite from OUR league's own roster format.
 *
 * An external trade is only comparable to ours if the format matches, so the
 * filter has to follow our configuration rather than assume a direction --
 * selecting single-QB leagues for a superflex league (or the reverse) would
 * gather precisely the wrong corpus while looking like it was working. Read
 * from league_formats via seasons.league_format_id rather than hard-coded, so
 * a format change here retargets the crawl instead of silently invalidating it.
 *
 * A league is superflex if it starts a QB/RB/WR/TE flex slot, or two or more
 * dedicated QBs -- the same test derive_is_superflex applies to the external
 * side, so both sides of the comparison are defined identically.
 */
const derive_import_appetite = async ({ lid, season_year }) => {
  const format = await db('seasons')
    .join('league_formats', 'league_formats.id', 'seasons.league_format_id')
    .select('league_formats.sqb', 'league_formats.sqbrbwrte')
    .where({ 'seasons.lid': lid, 'seasons.year': season_year })
    .first()

  if (!format) {
    throw new Error(
      `no league format found for lid ${lid} season ${season_year} -- cannot derive an import appetite, and guessing one would gather the wrong corpus`
    )
  }

  return {
    is_superflex: format.sqbrbwrte > 0 || format.sqb >= 2
  }
}

/**
 * Size the unexplored frontier.
 *
 * Logged at the end of every run so the crawl's health is observable without a
 * query: a frontier that is growing means the corpus can still expand, and one
 * that has collapsed to zero means the reachable graph is exhausted and a wider
 * appetite or a new seed is needed.
 */
const measure_frontier = async () => {
  const [users, member_lists, unimported] = await Promise.all([
    db('external_league_users')
      .where({ platform: 'sleeper' })
      .whereNull('last_crawled_at')
      .count('* as count')
      .first(),
    db('external_leagues')
      .where({ platform: 'sleeper' })
      .whereNull('member_list_crawled_at')
      .count('* as count')
      .first(),
    db('external_leagues')
      .where({ platform: 'sleeper' })
      .whereNull('last_synced_at')
      .count('* as count')
      .first()
  ])

  return {
    uncrawled_users: Number(users.count),
    uncrawled_league_member_lists: Number(member_lists.count),
    unimported_leagues: Number(unimported.count)
  }
}

/**
 * Select the leagues this run will import trades for.
 *
 * Separate budgets, because one shared budget would let refresh work starve
 * frontier expansion (or the reverse) depending only on how the ordering
 * happened to fall. import_limit takes never-imported leagues off the backlog
 * oldest-first; resync_limit refreshes already-imported leagues stalest-first,
 * which is how new trades in leagues we already know still get picked up -- and
 * during a live season, how buckets that did not exist at first import get
 * read once their weeks have happened.
 *
 * Note import_limit is deliberately NOT the crawl budget. A graph node costs
 * one or two requests to acquire and an import costs up to nineteen, so the
 * cheap thing should run far ahead of the expensive one: crawl broadly, import
 * narrowly, and let the backlog be the buffer between them.
 */
const select_leagues_to_import = async ({
  import_limit,
  resync_limit,
  dynasty_only,
  appetite
}) => {
  const apply_appetite = (query) => {
    if (!dynasty_only) {
      return query
    }

    return query.where({
      league_format: 'dynasty',
      // Superflex vs single-QB changes QB value by multiples, so the two are
      // not the same market and mixing them pollutes the fit. Matched to OUR
      // league rather than assumed -- getting the direction backwards would
      // select precisely the wrong corpus.
      is_superflex: appetite.is_superflex,
      // Both exclusions are about bundles that misrepresent the exchange:
      // an IDP league's unresolvable defender legs bias a side cheap, and
      // best-ball leagues barely trade in-season and price on a different
      // regime entirely.
      has_individual_defensive_players: false,
      is_best_ball: false
    })
  }

  const never_imported = await apply_appetite(
    db('external_leagues')
      .select('external_league_id', 'discovered_via')
      .where({ platform: 'sleeper' })
      .whereNull('last_synced_at')
  )
    .orderBy('created_at', 'asc')
    .limit(import_limit)

  const stalest_imported = resync_limit
    ? await apply_appetite(
        db('external_leagues')
          .select('external_league_id', 'discovered_via')
          .where({ platform: 'sleeper' })
          .whereNotNull('last_synced_at')
      )
        .orderBy('last_synced_at', 'asc')
        .limit(resync_limit)
    : []

  return [...never_imported, ...stalest_imported]
}

const import_sleeper_external_league_trades = async ({
  seed_league_ids = [],
  season_year = current_season.year,
  limit = 200,
  import_limit = 25,
  resync_limit = 25,
  history_depth = 4,
  max_runtime_minutes = null,
  dry_run = false,
  dynasty_only = true,
  lid = 1
} = {}) => {
  const appetite = await derive_import_appetite({ lid, season_year })

  // Logged rather than assumed silently: if this ever reads backwards, the run
  // that gathered the wrong corpus should say so in its own output.
  log(
    `import appetite: dynasty, ${appetite.is_superflex ? 'superflex' : 'single-QB'}, no IDP, no best-ball (derived from lid ${lid} ${season_year})`
  )

  // The crawl IS persistence -- its whole product is graph rows, and it reads
  // its own frontier back to decide where to go next -- so there is no coherent
  // dry version of it. A dry run therefore skips it entirely and reports what
  // importing the existing backlog would do, which keeps --dry meaning exactly
  // "makes no writes".
  const crawl_totals = dry_run
    ? { new_leagues: 0, users_expanded: 0, member_lists_crawled: 0 }
    : await crawl_sleeper_league_graph({
        seed_league_ids,
        season_year,
        new_league_limit: limit,
        max_runtime_minutes
      })

  const selected = await select_leagues_to_import({
    import_limit,
    resync_limit,
    dynasty_only,
    appetite
  })

  log(`importing ${selected.length} leagues`)

  const totals = { leagues: 0, skipped: 0, trades: 0, legs: 0, unresolved: 0 }

  // Discovery only sees ONE season, because /user/{id}/leagues/nfl/{season} is
  // season-scoped. Each league payload carries previous_league_id, so walking
  // that chain harvests prior league-seasons for one request each -- by far the
  // cheapest volume available, and it extends the observation window backward
  // in time, which a value fit wants. Consumed as a queue so the chain is
  // followed to history_depth without recursion.
  const pending = selected.map((row) => ({
    external_league_id: row.external_league_id,
    discovered_via: row.discovered_via,
    depth: 0
  }))
  const seen = new Set(selected.map((row) => row.external_league_id))

  // Prior league-seasons are complete and immutable, so one already imported is
  // never worth 19 requests again. Without this the chain walk re-paid for the
  // entire back-catalogue on every single run.
  const previously_imported_chain_links = new Set(
    (
      await db('external_leagues')
        .select('external_league_id')
        .where({ platform: 'sleeper' })
        .whereNotNull('last_synced_at')
    ).map((row) => row.external_league_id)
  )

  while (pending.length) {
    const { external_league_id, discovered_via, depth } = pending.shift()

    // One bad league must not abort a crawl of hundreds. The failure is logged
    // and counted rather than swallowed silently.
    try {
      const result = await import_sleeper_league_trades({
        external_league_id,
        discovered_via,
        dry_run
      })

      if (result.skipped) {
        totals.skipped += 1
        continue
      }

      totals.leagues += 1
      totals.trades += result.trades
      totals.legs += result.legs
      totals.unresolved += result.unresolved

      const previous_league_id = result.league_row?.previous_external_league_id
      if (previous_league_id && depth < history_depth) {
        if (
          !seen.has(previous_league_id) &&
          !previously_imported_chain_links.has(previous_league_id)
        ) {
          seen.add(previous_league_id)
          pending.push({
            external_league_id: previous_league_id,
            discovered_via: 'previous_season',
            depth: depth + 1
          })
        }
      }
    } catch (error) {
      totals.skipped += 1
      log(`league ${external_league_id} failed: ${error.message}`)
    }
  }

  const frontier = await measure_frontier()

  log(
    `imported ${totals.trades} trades / ${totals.legs} legs from ${totals.leagues} leagues (${totals.skipped} skipped, ${totals.unresolved} unresolved players, ${request_counts.crawl} crawl + ${request_counts.import} import requests)`
  )
  log(
    `frontier: ${frontier.uncrawled_users} managers and ${frontier.uncrawled_league_member_lists} league member lists unexplored, ${frontier.unimported_leagues} leagues known but not imported`
  )

  // The output oracle is distinct from the exit code: a run that discovers
  // leagues but lands zero trades has failed at its actual purpose even though
  // every request returned 200, so it is surfaced as an error rather than a
  // silent green.
  if (!dry_run && totals.leagues > 0 && totals.trades === 0) {
    throw new Error(
      `imported ${totals.leagues} leagues but zero trades -- payload shape may have changed`
    )
  }

  // The import oracle above goes INERT whenever imports are paused: with
  // import_limit 0 no league is ever selected, so totals.leagues is 0 and the
  // condition cannot fire. A graph-only run would then report green no matter
  // what Sleeper returned. This is the crawl-stage equivalent -- the crawl's
  // product is new graph rows, so spending a run's worth of requests and
  // acquiring nothing is the same class of silent failure.
  //
  // Thresholded at 20 requests and gated on new_leagues specifically, because
  // the honest non-failures all sit below that line: an exhausted graph makes no
  // requests at all, and a deadline that fires early makes only a few. A run
  // that expands managers 20+ times and finds not one league absent from a
  // corpus this small is a payload-shape break, not a saturated neighbourhood.
  if (
    !dry_run &&
    request_counts.crawl >= 20 &&
    crawl_totals.new_leagues === 0
  ) {
    throw new Error(
      `crawl spent ${request_counts.crawl} requests and discovered zero new leagues -- payload shape may have changed`
    )
  }

  return { ...totals, ...crawl_totals, frontier }
}

const main = async () => {
  let error
  try {
    // --seed_league_id is a BOOTSTRAP for an empty graph, not a permanent
    //   anchor: once anything is persisted the crawl resumes from the frontier
    //   and this argument is never consulted.
    // --limit is the CRAWL budget: how many NEW leagues to take into the graph
    //   this run, NOT the total crawl size and NOT how many get imported. A
    //   weekly cron therefore extends the frontier by that many leagues each
    //   time instead of re-walking the same neighbourhood.
    // --import_limit is the IMPORT budget: how many never-imported leagues to
    //   pull trades for, oldest-discovered first. Deliberately much smaller
    //   than --limit -- a graph node costs one or two requests and an import
    //   costs up to nineteen, so the map should run well ahead of the import
    //   and the backlog absorbs the difference.
    // --resync_limit is how many ALREADY-imported leagues to refresh for new
    //   trades, stalest first. Separate budget so refresh work cannot starve
    //   frontier expansion.
    // --max_runtime_minutes is a DEADLINE on the crawl stage. It exists because
    //   --limit counts leagues while the rate limit prices requests, so the two
    //   are related only by a yield that drifts downward as the graph
    //   saturates; only a deadline bounds wall clock no matter what the yield
    //   does. Set it whenever --limit is large enough that the run could
    //   otherwise still be going when the next one starts.
    const seed_league_ids = argv.seed_league_id
      ? [].concat(argv.seed_league_id).map(String)
      : []

    await import_sleeper_external_league_trades({
      seed_league_ids,
      season_year: argv.season_year ? Number(argv.season_year) : undefined,
      // Compared against undefined rather than tested for truthiness: `0` is a
      // meaningful value for every budget (skip the crawl / skip the import /
      // skip the refresh) and a truthiness test would silently substitute the
      // default instead.
      limit: argv.limit === undefined ? undefined : Number(argv.limit),
      import_limit:
        argv.import_limit === undefined ? undefined : Number(argv.import_limit),
      resync_limit:
        argv.resync_limit === undefined ? undefined : Number(argv.resync_limit),
      history_depth:
        argv.history_depth === undefined
          ? undefined
          : Number(argv.history_depth),
      max_runtime_minutes:
        argv.max_runtime_minutes === undefined
          ? undefined
          : Number(argv.max_runtime_minutes),
      dry_run: Boolean(argv.dry),
      dynasty_only: argv.dynasty_only !== false
    })
  } catch (err) {
    error = err
    log(error)
  }

  await report_job({
    job_type: job_types.IMPORT_SLEEPER_EXTERNAL_LEAGUE_TRADES,
    error
  })

  process.exit(error ? 1 : 0)
}

if (is_main(import.meta.url)) {
  main()
}

export default import_sleeper_external_league_trades
