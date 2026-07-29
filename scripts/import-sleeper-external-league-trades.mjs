import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { is_main, report_job, batch_insert } from '#libs-server'
import { job_types } from '#libs-shared/job-constants.mjs'
import {
  parse_sleeper_league,
  parse_sleeper_transactions
} from '#libs-server/external-league-trades/sleeper-trade-parser.mjs'

const log = debug('import-sleeper-external-league-trades')
debug.enable('import-sleeper-external-league-trades')

const argv = yargs(hideBin(process.argv)).argv

const SLEEPER_API_URL = 'https://api.sleeper.app/v1'

// Sleeper documents a ~1000 req/min ceiling before IP blocking, and a
// third-party source reports 90/min. We sit far under both: this is a
// background enrichment job with no deadline, and being cheap to host is worth
// more than finishing an hour sooner.
const REQUEST_DELAY_MS = 120

// Sleeper files transactions in per-week buckets; bucket 1 also carries the
// entire offseason, which is where most dynasty trading happens.
const TRANSACTION_BUCKETS = 18

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

let request_count = 0

const sleeper_get = async (path) => {
  await sleep(REQUEST_DELAY_MS)
  request_count += 1

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
 * match rate on real traded players was 176/176, so a fallback would add a
 * fuzzy-match failure mode to buy approximately nothing. Unresolved ids are
 * returned as null pids and stored that way, which makes a future regression
 * countable via idx_external_league_trade_legs_unresolved.
 */
const resolve_player_ids = async (external_player_ids) => {
  if (!external_player_ids.length) {
    return new Map()
  }

  const rows = await db('player')
    .select('pid', 'sleeper_player_id')
    .whereIn('sleeper_player_id', external_player_ids)

  return new Map(rows.map((row) => [String(row.sleeper_player_id), row.pid]))
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

  const parsed_trades = []
  for (let bucket = 1; bucket <= TRANSACTION_BUCKETS; bucket++) {
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

  await db('external_leagues')
    .insert({ ...league_row, last_synced_at: new Date() })
    .onConflict(['platform', 'external_league_id'])
    .merge()

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

/**
 * Expand the set of known leagues by snowball crawl.
 *
 * Sleeper has no "list public leagues" endpoint, but the graph is traversable
 * from any seed: /league/{id}/users gives every member's user_id, and
 * /user/{user_id}/leagues/nfl/{season} gives every league that user is in. The
 * frontier grows on its own, so the corpus is bounded by our appetite rather
 * than by anything Sleeper exposes. All of it is public read-only data and no
 * membership is required.
 *
 * Note this biases toward leagues whose managers play in many leagues.
 * discovered_via is recorded per league so that bias is measurable later rather
 * than baked in invisibly.
 */
export const discover_sleeper_leagues = async ({
  seed_league_ids,
  season_year,
  limit,
  dynasty_only = true
}) => {
  const discovered = new Map()
  const visited_users = new Set()
  const queue = [...seed_league_ids]

  for (const seed of seed_league_ids) {
    discovered.set(String(seed), 'seed')
  }

  while (queue.length && discovered.size < limit) {
    const league_id = queue.shift()

    const users = await sleeper_get(`/league/${league_id}/users`)
    if (!users) {
      continue
    }

    for (const user of users) {
      if (discovered.size >= limit) {
        break
      }
      if (!user.user_id || visited_users.has(user.user_id)) {
        continue
      }
      visited_users.add(user.user_id)

      const user_leagues = await sleeper_get(
        `/user/${user.user_id}/leagues/nfl/${season_year}`
      )
      if (!user_leagues) {
        continue
      }

      for (const user_league of user_leagues) {
        if (discovered.size >= limit) {
          break
        }
        if (discovered.has(String(user_league.league_id))) {
          continue
        }
        // Filter on the cheap payload we already have rather than fetching the
        // league again. Redraft leagues price players completely differently
        // and are not the signal the dynasty valuation wants.
        if (dynasty_only && user_league.settings?.type !== 2) {
          continue
        }

        discovered.set(String(user_league.league_id), 'user_leagues')
        queue.push(String(user_league.league_id))
      }
    }
  }

  return discovered
}

const import_sleeper_external_league_trades = async ({
  seed_league_ids,
  season_year,
  limit = 25,
  dry_run = false,
  dynasty_only = true
} = {}) => {
  if (!seed_league_ids?.length) {
    throw new Error('at least one --seed-league-id is required')
  }

  const discovered = await discover_sleeper_leagues({
    seed_league_ids,
    season_year,
    limit,
    dynasty_only
  })

  log(`discovered ${discovered.size} leagues, importing`)

  const totals = { leagues: 0, skipped: 0, trades: 0, legs: 0, unresolved: 0 }

  for (const [external_league_id, discovered_via] of discovered) {
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
    } catch (error) {
      totals.skipped += 1
      log(`league ${external_league_id} failed: ${error.message}`)
    }
  }

  log(
    `imported ${totals.trades} trades / ${totals.legs} legs from ${totals.leagues} leagues (${totals.skipped} skipped, ${totals.unresolved} unresolved players, ${request_count} requests)`
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

  return totals
}

const main = async () => {
  let error
  try {
    const seed_league_ids = argv.seed_league_id
      ? [].concat(argv.seed_league_id).map(String)
      : []

    await import_sleeper_external_league_trades({
      seed_league_ids,
      season_year: argv.season_year,
      limit: argv.limit ? Number(argv.limit) : undefined,
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
