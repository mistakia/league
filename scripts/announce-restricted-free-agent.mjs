import debug from 'debug'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc.js'
import timezone from 'dayjs/plugin/timezone.js'
import db from '#db'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import { current_season } from '#constants'
import timestamptz_to_epoch from '#libs-shared/timestamptz-to-epoch.mjs'
import {
  Errors,
  get_restricted_free_agency_window_start,
  get_restricted_free_agency_window_index,
  get_restricted_free_agency_nominating_team_index,
  league_timezone
} from '#libs-shared'
import {
  is_main,
  sendNotifications,
  getLeague,
  report_job,
  claim_league_notification,
  has_league_notification_been_sent,
  throw_if_shortfall
} from '#libs-server'
import { get_open_league_pause } from '#libs-server/league-pause.mjs'
import { job_types } from '#libs-shared/job-constants.mjs'

const NOTIFICATION_TYPE_RFA_ANNOUNCED = 'rfa_announced'

// Initialize dayjs plugins
dayjs.extend(utc)
dayjs.extend(timezone)

const initialize_cli = () => {
  return yargs(hideBin(process.argv)).argv
}

const log = debug('announce-restricted-free-agent')
debug.enable('announce-restricted-free-agent')

const ET_FORMAT = 'YYYY-MM-DD HH:mm:ss [ET]'

// Window boundaries are unix seconds
const format_et = (timestamp) =>
  dayjs.unix(timestamp).tz(league_timezone).format(ET_FORMAT)

// The anchor column is timestamptz, so it arrives as a Date rather than a number
const format_timestamptz_et = (value) =>
  dayjs(value).tz(league_timezone).format(ET_FORMAT)

/**
 * Leagues whose restricted free agency period is currently open.
 */
const get_active_leagues = async () => {
  // The period bounds are timestamptz as of the 2026-08-07 conformance pass, so
  // the comparison value is an instant rather than epoch seconds.
  const now_instant = new Date()

  const active_leagues = await db('seasons')
    .select('seasons.*', 'leagues.name as name')
    .join('leagues', 'leagues.uid', '=', 'seasons.lid')
    .where({ 'seasons.season_year': current_season.year })
    .whereNotNull('restricted_free_agency_period_start')
    .whereNotNull('restricted_free_agency_first_window_at')
    .where('restricted_free_agency_period_start', '<=', now_instant)
    .where('restricted_free_agency_period_end', '>=', now_instant)

  log(`Found ${active_leagues.length} active leagues in RFA period`)

  return active_leagues
}

const announce_restricted_free_agent = async ({
  lid,
  tid = null,
  window_index = null,
  dry_run = false
}) => {
  if (!lid) {
    throw new Error('lid is required')
  }

  if (dry_run) {
    log('DRY RUN MODE: No database changes or notifications will be sent')
  }

  const league = await getLeague({ lid })

  if (!league) {
    throw new Error(`League with lid ${lid} not found`)
  }

  // Gated here as well as in the scheduled loop, so the --lid override cannot
  // announce into a paused league.
  const open_pause = await get_open_league_pause({ league_id: lid })
  if (open_pause) {
    throw new Errors.LeaguePaused(`league ${lid} is paused`)
  }

  if (!league.restricted_free_agency_period_start) {
    throw new Error(
      `League with lid ${lid} does not have a restricted_free_agency_period_start date`
    )
  }

  if (!league.restricted_free_agency_first_window_at) {
    throw new Error(
      `League with lid ${lid} does not have a restricted_free_agency_first_window_at anchor`
    )
  }

  const current_timestamp = Math.round(Date.now() / 1000)

  if (
    current_timestamp >
    timestamptz_to_epoch(league.restricted_free_agency_period_end)
  ) {
    throw new Error(
      `The restricted free agency period ended on ${format_timestamptz_et(
        league.restricted_free_agency_period_end
      )}`
    )
  }

  const target_window_index =
    window_index === null
      ? get_restricted_free_agency_window_index({
          league,
          timestamp: current_timestamp
        })
      : Number(window_index)

  if (target_window_index < 0) {
    log(
      `No nomination window has opened yet for league ${lid} — the first opens ${format_timestamptz_et(
        league.restricted_free_agency_first_window_at
      )}`
    )
    return
  }

  const announcement_timestamp = get_restricted_free_agency_window_start({
    league,
    window_index: target_window_index
  })

  if (!dry_run && current_timestamp < announcement_timestamp) {
    throw new Error(
      `Cannot announce window ${target_window_index} yet — it opens ${format_et(
        announcement_timestamp
      )}`
    )
  }

  const teams = await db('teams')
    .where({ lid, season_year: current_season.year })
    .orderBy('draft_order', 'desc')

  let nominating_team

  if (tid) {
    nominating_team = teams.find((team) => team.uid === tid)

    if (!nominating_team) {
      throw new Error(`Team with tid ${tid} not found in league ${lid}`)
    }

    log(
      `Using overridden nominating team: ${nominating_team.name} (${nominating_team.abbreviation})`
    )
  } else {
    const team_index = get_restricted_free_agency_nominating_team_index({
      window_index: target_window_index,
      number_teams: teams.length
    })
    nominating_team = teams[team_index]
  }

  if (!nominating_team) {
    throw new Error(`No nominating team found for league ${lid}`)
  }

  log(
    `Window ${target_window_index} (opens ${format_et(
      announcement_timestamp
    )}) belongs to ${nominating_team.name} (${nominating_team.abbreviation})`
  )

  // The nomination is the auction, so the pending-announcement question is asked
  // of it rather than of the nominating team's bid. Announcement describes the
  // player's window, and hanging it off one bid row is what let every competing
  // bid carry a null that read as "due immediately".
  const nomination = await db('restricted_free_agency_nominations')
    .where({
      league_id: lid,
      season_year: current_season.year,
      original_team_id: nominating_team.uid
    })
    .whereNotNull('nominated_at')
    .whereNull('announced_at')
    .whereNull('processed_at')
    .first()

  let message
  let metadata

  if (nomination) {
    const player_row = await db('player')
      .where({ pid: nomination.player_id })
      .first()

    if (!player_row) {
      throw new Error(
        `Player with pid ${nomination.player_id} for team ${nominating_team.uid} not found`
      )
    }

    message = `${nominating_team.name} (${nominating_team.abbreviation}) has announced ${player_row.first_name} ${player_row.last_name} (${player_row.primary_position}) as a restricted free agent`
    metadata = {
      tid: nominating_team.uid,
      pid: nomination.player_id,
      nomination_id: nomination.nomination_id,
      window_index: target_window_index
    }
  } else {
    // No nomination for this window: record a marker so the oracle can confirm
    // the window was visited rather than silently skipped.
    message = `No RFA nomination pending for team ${nominating_team.uid} in window ${target_window_index}`
    metadata = {
      tid: nominating_team.uid,
      no_nomination: true,
      window_index: target_window_index
    }
  }

  if (dry_run) {
    log(`DRY RUN: Would announce at ${format_et(announcement_timestamp)}`)
    log(`DRY RUN: Would send notification: ${message}`)
    return
  }

  const claimed = await claim_league_notification({
    lid,
    season_year: current_season.year,
    notification_type: NOTIFICATION_TYPE_RFA_ANNOUNCED,
    event_timestamp: announcement_timestamp,
    message,
    metadata
  })

  if (!claimed) {
    log(
      `Window ${target_window_index} already announced for league ${lid}; skipping`
    )
    return
  }

  if (nomination) {
    await db('restricted_free_agency_nominations')
      .where({ nomination_id: nomination.nomination_id })
      .update({
        announced_at: db.raw('to_timestamp(?)', [announcement_timestamp])
      })

    await sendNotifications({
      league,
      notifyLeague: true,
      message
    })

    log(`Announcement timestamp set to ${format_et(announcement_timestamp)}`)
    log(`Notification sent: ${message}`)
  } else {
    log(
      `No unprocessed nominated player found for team ${nominating_team.uid} in window ${target_window_index}`
    )
  }
}

// Returns { shortfall } where shortfall is null when there was no due work or
// all due leagues were processed, and a descriptive string when a league was
// due but its notification marker was not written (silent partial-success).
const process_all_leagues = async ({ dry_run = false } = {}) => {
  const active_leagues = await get_active_leagues()

  if (!active_leagues.length) {
    log('No active leagues found in an RFA period')
    return { shortfall: null }
  }

  const current_timestamp = Math.round(Date.now() / 1000)
  const due_leagues = []

  for (const league of active_leagues) {
    const open_pause = await get_open_league_pause({ league_id: league.lid })
    if (open_pause) {
      // Excluded from due_leagues rather than merely skipped: the oracle below
      // asserts a marker for every entry, and a held league never writes one.
      log(`league ${league.lid}: LEAGUE PAUSED -- holding RFA announcement`)
      continue
    }

    const window_index = get_restricted_free_agency_window_index({
      league,
      timestamp: current_timestamp
    })

    if (window_index < 0) {
      continue
    }

    const announcement_timestamp = get_restricted_free_agency_window_start({
      league,
      window_index
    })

    if (dry_run) {
      due_leagues.push({ lid: league.lid, announcement_timestamp })
      continue
    }

    const already_sent = await has_league_notification_been_sent({
      lid: league.lid,
      season_year: current_season.year,
      notification_type: NOTIFICATION_TYPE_RFA_ANNOUNCED,
      event_timestamp: announcement_timestamp
    })

    if (already_sent) {
      log(
        `league ${league.lid}: window ${window_index} already announced; skipping`
      )
      continue
    }

    due_leagues.push({ lid: league.lid, announcement_timestamp })
  }

  if (!due_leagues.length) {
    log('All active leagues already announced for their current window')
    return { shortfall: null }
  }

  for (const { lid } of due_leagues) {
    try {
      log(`Processing league ${lid}`)
      await announce_restricted_free_agent({ lid, dry_run })
    } catch (err) {
      log(`Error processing league ${lid}: ${err.message}`)
    }
  }

  log(`Completed processing ${due_leagues.length} leagues`)

  if (dry_run) {
    return { shortfall: null }
  }

  // Oracle: every due league must now carry a marker for its window. A missing
  // marker means the run completed without throwing but never reached the
  // claim path — silent partial-success.
  const shortfalls = []
  for (const { lid, announcement_timestamp } of due_leagues) {
    const marker_written = await has_league_notification_been_sent({
      lid,
      season_year: current_season.year,
      notification_type: NOTIFICATION_TYPE_RFA_ANNOUNCED,
      event_timestamp: announcement_timestamp
    })
    if (!marker_written) {
      shortfalls.push(
        `league ${lid}: RFA announcement due (window opens ${announcement_timestamp}) but notification marker absent after run`
      )
    }
  }

  return { shortfall: shortfalls.length > 0 ? shortfalls.join('; ') : null }
}

const main = async () => {
  let error
  const argv = initialize_cli()
  // yargs camel-case-expands `--dry-run` to the `dryRun` key (not `dry_run`),
  // so without this, `--dry-run` silently ran the script live. Accept both.
  const { lid, tid, window_index, dryRun } = argv
  const dry_run = Boolean(argv.dry_run || dryRun)

  try {
    if (lid) {
      await announce_restricted_free_agent({
        lid,
        tid,
        window_index: window_index === undefined ? null : window_index,
        dry_run
      })
    } else {
      const { shortfall } = await process_all_leagues({ dry_run })
      throw_if_shortfall(shortfall)
    }
  } catch (err) {
    error = err
    log(error)
  }

  if (!dry_run) {
    await report_job({
      job_type: job_types.ANNOUNCE_RESTRICTED_FREE_AGENT,
      error
    })
  }

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default announce_restricted_free_agent
