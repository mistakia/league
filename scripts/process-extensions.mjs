import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { Errors, Roster, getExtensionAmount } from '#libs-shared'
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
  record_league_notification_sent,
  throw_if_shortfall
} from '#libs-server'
import { get_open_league_pause } from '#libs-server/league-pause.mjs'
import { job_types } from '#libs-shared/job-constants.mjs'
import timestamptz_to_epoch from '#libs-shared/timestamptz-to-epoch.mjs'

// Auto-process retry window: keep attempting for this many days past extension_deadline_at
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
  const { player_salary: value } = await getLastTransaction({
    pid,
    tid,
    lid: league.uid
  })
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
    user_id: 0,
    tid,
    lid: league.uid,
    pid,
    type: getTransactionType(tag),
    player_salary: extensionValue,
    week: current_season.week,
    season_year: current_season.year,
    occurred_at: league.extension_deadline_at
  }
}

const run = async ({ lid }) => {
  // Gated HERE rather than only in the scheduled loop because the --lid
  // override calls run() directly and is documented as "run immediately, no
  // gating". A pause is the one gate that override must not bypass: extensions
  // are irreversible roster writes.
  const open_pause = await get_open_league_pause({ league_id: lid })
  if (open_pause) {
    throw new Errors.LeaguePaused(`league ${lid} is paused`)
  }

  const league = await getLeague({ lid })
  const teams = await db('teams').where({
    lid,
    season_year: current_season.year
  })
  await db('transactions')
    .where({
      user_id: 0,
      lid,
      season_year: current_season.year
    })
    .whereIn('type', [
      transaction_types.FRANCHISE_TAG,
      transaction_types.ROOKIE_TAG,
      transaction_types.EXTENSION
    ])
    .del()

  for (const team of teams) {
    const tid = team.team_id
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

// Auto-process extensions for any hosted league whose extension_deadline_at has passed and
// has not yet been processed for this season. Idempotent at three levels:
// (1) `run({ lid })` itself rebuilds the year's tag/extension transactions from
// rosters_players state (DELETE-then-INSERT); (2) the notification marker below
// short-circuits subsequent cron firings; (3) the unique constraint on
// (lid, season_year, notification_type, event_timestamp) guards against races.
//
// Returns { shortfall } where shortfall is null when there was no due work
// (empty-queue) or all due leagues were successfully processed, and a
// descriptive string when a league was due but its notification marker was not
// written (silent partial-success).
const process_extensions_for_due_leagues = async () => {
  const now = Math.round(Date.now() / 1000)
  const window_end = (extension_deadline_at) =>
    extension_deadline_at + AUTO_PROCESS_WINDOW_DAYS * 86400

  const eligible = await db('seasons')
    .join('leagues', 'leagues.uid', 'seasons.lid')
    .where({
      'seasons.season_year': current_season.year,
      'leagues.is_hosted': true
    })
    .whereNotNull('seasons.extension_deadline_at')
    .select('seasons.lid', 'seasons.extension_deadline_at')

  // Track leagues that are inside the processing window and not yet marked done
  // before this run starts. These are the leagues we must successfully process.
  const due_leagues = []

  for (const { lid, extension_deadline_at: ext_date_instant } of eligible) {
    // seasons.extension_deadline_at is timestamptz as of the 2026-08-07 conformance pass.
    // Converting once here keeps the deadline comparison, the retry-window
    // arithmetic and the epoch-seconds marker key all in one unit — read as a
    // Date, `now < extension_deadline_at` coerces to milliseconds and is ALWAYS true, which
    // silently skipped every league.
    const extension_deadline_at = timestamptz_to_epoch(ext_date_instant)

    if (now < extension_deadline_at) {
      log(
        `league ${lid}: extension_deadline_at ${extension_deadline_at} not yet reached (now=${now}); skipping`
      )
      continue
    }
    if (now > window_end(extension_deadline_at)) {
      log(
        `league ${lid}: extension_deadline_at ${extension_deadline_at} more than ${AUTO_PROCESS_WINDOW_DAYS} days past; skipping`
      )
      continue
    }
    const already_processed = await has_league_notification_been_sent({
      lid,
      season_year: current_season.year,
      notification_type: NOTIFICATION_TYPE_EXTENSIONS_PROCESSED,
      event_timestamp: extension_deadline_at
    })
    if (already_processed) {
      log(
        `league ${lid}: extensions already processed for extension_deadline_at ${extension_deadline_at}`
      )
      continue
    }

    const open_pause = await get_open_league_pause({ league_id: lid })
    if (open_pause) {
      // Excluded from due_leagues, not merely skipped: the oracle below asserts
      // a notification marker for every league in that list, and a held league
      // never writes one. Leaving it in would report the hold as a shortfall.
      log(`league ${lid}: LEAGUE PAUSED -- holding extensions`)
      continue
    }

    due_leagues.push({ lid, extension_deadline_at })

    log(
      `league ${lid}: processing extensions (extension_deadline_at ${extension_deadline_at} reached)`
    )
    await run({ lid })
    await record_league_notification_sent({
      lid,
      season_year: current_season.year,
      notification_type: NOTIFICATION_TYPE_EXTENSIONS_PROCESSED,
      event_timestamp: extension_deadline_at,
      message: `Extensions auto-applied at extension_deadline_at for league ${lid}`,
      metadata: { extension_deadline_at, processed_at: now }
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
  for (const { lid, extension_deadline_at } of due_leagues) {
    const marker_written = await has_league_notification_been_sent({
      lid,
      season_year: current_season.year,
      notification_type: NOTIFICATION_TYPE_EXTENSIONS_PROCESSED,
      event_timestamp: extension_deadline_at
    })
    if (!marker_written) {
      shortfalls.push(
        `league ${lid}: extensions due (extension_deadline_at=${extension_deadline_at}) but notification marker absent after run`
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
      throw_if_shortfall(shortfall)
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
