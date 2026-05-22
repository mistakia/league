import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { Roster, getExtensionAmount } from '#libs-shared'
import { current_season, player_tag_types, transaction_types } from '#constants'
import {
  getLeague,
  getRoster,
  getPlayerExtensions,
  getLastTransaction,
  report_job,
  is_main,
  validate_franchise_tag,
  has_league_notification_been_sent,
  record_league_notification_sent
} from '#libs-server'
import { job_types } from '#libs-shared/job-constants.mjs'

// Auto-process retry window: keep attempting for this many days past ext_date
// in case the cron is missed (e.g., outage). The notification marker still
// guarantees one-shot semantics within the window.
const AUTO_PROCESS_WINDOW_DAYS = 14
const NOTIFICATION_TYPE_EXTENSIONS_PROCESSED = 'extensions_processed'

const initialize_cli = () => {
  return yargs(hideBin(process.argv)).argv
}

const log = debug('process-extensions')
debug.enable('process-extensions')

const getTransactionType = (tag) => {
  switch (tag) {
    case player_tag_types.FRANCHISE:
      return transaction_types.FRANCHISE_TAG
    case player_tag_types.ROOKIE:
      return transaction_types.ROOKIE_TAG
    case player_tag_types.REGULAR:
    case player_tag_types.RESTRICTED_FREE_AGENCY:
      return transaction_types.EXTENSION
  }
}

const createTransaction = async ({ roster_player, tid, league }) => {
  const { tag, pid, pos } = roster_player

  // Skip creating franchise tag transactions for players who already had franchise tags for two consecutive years
  if (tag === player_tag_types.FRANCHISE) {
    const is_valid_franchise_tag = await validate_franchise_tag({
      pid,
      tid
    })

    if (!is_valid_franchise_tag) {
      throw new Error(
        'player cannot be franchise tagged for three consecutive years'
      )
    }
  }

  const extensions = await getPlayerExtensions({
    lid: league.uid,
    pid
  })
  const { value } = await getLastTransaction({ pid, tid, lid: league.uid })
  const extensionValue = getExtensionAmount({
    extensions: extensions.length,
    tag:
      tag === player_tag_types.RESTRICTED_FREE_AGENCY
        ? player_tag_types.REGULAR
        : tag,
    pos,
    league,
    value
  })

  return {
    userid: 0,
    tid,
    lid: league.uid,
    pid,
    type: getTransactionType(tag),
    value: extensionValue,
    week: current_season.week,
    year: current_season.year,
    timestamp: league.ext_date
  }
}

const run = async ({ lid }) => {
  const league = await getLeague({ lid })
  const teams = await db('teams').where({ lid, year: current_season.year })
  await db('transactions')
    .where({
      userid: 0,
      lid,
      year: current_season.year
    })
    .whereIn('type', [
      transaction_types.FRANCHISE_TAG,
      transaction_types.ROOKIE_TAG,
      transaction_types.EXTENSION
    ])
    .del()

  for (const team of teams) {
    const tid = team.uid
    const rosterRow = await getRoster({ tid })
    const roster = new Roster({ roster: rosterRow, league })
    const transactions = []
    const roster_players = [...roster.active, ...roster.reserve]
    for (const roster_player of roster_players) {
      const transaction = await createTransaction({
        roster_player,
        tid,
        league
      })
      if (transaction) transactions.push(transaction)
    }

    if (transactions.length) {
      log(`creating ${transactions.length} transactions for teamId: ${tid}`)
      await db('transactions').insert(transactions)
    }
  }
}

// Auto-process extensions for any hosted league whose ext_date has passed and
// has not yet been processed for this season. Idempotent at three levels:
// (1) `run({ lid })` itself rebuilds the year's tag/extension transactions from
// rosters_players state (DELETE-then-INSERT); (2) the notification marker below
// short-circuits subsequent cron firings; (3) the unique constraint on
// (lid, year, notification_type, event_timestamp) guards against races.
//
// Returns { shortfall } where shortfall is null when there was no due work
// (empty-queue) or all due leagues were successfully processed, and a
// descriptive string when a league was due but its notification marker was not
// written (silent partial-success).
const process_extensions_for_due_leagues = async () => {
  const now = Math.round(Date.now() / 1000)
  const window_end = (ext_date) => ext_date + AUTO_PROCESS_WINDOW_DAYS * 86400

  const eligible = await db('seasons')
    .join('leagues', 'leagues.uid', 'seasons.lid')
    .where({ 'seasons.year': current_season.year, 'leagues.hosted': true })
    .whereNotNull('seasons.ext_date')
    .select('seasons.lid', 'seasons.ext_date')

  // Track leagues that are inside the processing window and not yet marked done
  // before this run starts. These are the leagues we must successfully process.
  const due_leagues = []

  for (const { lid, ext_date } of eligible) {
    if (now < ext_date) {
      log(
        `league ${lid}: ext_date ${ext_date} not yet reached (now=${now}); skipping`
      )
      continue
    }
    if (now > window_end(ext_date)) {
      log(
        `league ${lid}: ext_date ${ext_date} more than ${AUTO_PROCESS_WINDOW_DAYS} days past; skipping`
      )
      continue
    }
    const already_processed = await has_league_notification_been_sent({
      lid,
      year: current_season.year,
      notification_type: NOTIFICATION_TYPE_EXTENSIONS_PROCESSED,
      event_timestamp: ext_date
    })
    if (already_processed) {
      log(
        `league ${lid}: extensions already processed for ext_date ${ext_date}`
      )
      continue
    }

    due_leagues.push({ lid, ext_date })

    log(`league ${lid}: processing extensions (ext_date ${ext_date} reached)`)
    await run({ lid })
    await record_league_notification_sent({
      lid,
      year: current_season.year,
      notification_type: NOTIFICATION_TYPE_EXTENSIONS_PROCESSED,
      event_timestamp: ext_date,
      message: `Extensions auto-applied at ext_date for league ${lid}`,
      metadata: { ext_date, processed_at: now }
    })
  }

  // Empty-queue: no leagues were due and unprocessed — nothing to verify.
  if (due_leagues.length === 0) {
    return { shortfall: null }
  }

  // Oracle: for every league we attempted to process, the notification marker
  // must now exist. A missing marker means run() completed (no throw) but the
  // record_league_notification_sent call was skipped or the script short-
  // circuited before reaching it — silent partial-success.
  const shortfalls = []
  for (const { lid, ext_date } of due_leagues) {
    const marker_written = await has_league_notification_been_sent({
      lid,
      year: current_season.year,
      notification_type: NOTIFICATION_TYPE_EXTENSIONS_PROCESSED,
      event_timestamp: ext_date
    })
    if (!marker_written) {
      shortfalls.push(
        `league ${lid}: extensions due (ext_date=${ext_date}) but notification marker absent after run`
      )
    }
  }

  return { shortfall: shortfalls.length > 0 ? shortfalls.join('; ') : null }
}

const main = async () => {
  let error
  try {
    const argv = initialize_cli()
    const lid = argv.lid
    if (lid) {
      // Manual override: run immediately, no gating.
      await run({ lid })
    } else {
      const { shortfall } = await process_extensions_for_due_leagues()
      if (shortfall) {
        const err = new Error(shortfall)
        err.row_count_shortfall = true
        throw err
      }
    }
  } catch (err) {
    error = err
    console.log(error)
  }

  await report_job({
    job_type: job_types.PROCESS_EXTENSIONS,
    error
  })

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default run
