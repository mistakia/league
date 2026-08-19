import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc.js'
import timezone from 'dayjs/plugin/timezone.js'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { current_season } from '#constants'
import { league_timezone } from '#libs-shared'
import { is_main } from '#libs-server'

dayjs.extend(utc)
dayjs.extend(timezone)

// Pause or resume restricted free agency bid PROCESSING for one league-season.
//
// This is the supported lever. The lever it replaces was commenting out the
// crontab line for process-restricted-free-agency-bids.mjs on
// league-production, which needs root SSH, pauses every league at once, is
// reverted by the next crontab deploy, records nothing about who or why, and
// makes the job go dark so the runs-ledger staleness sweep reads the hold as a
// broken pipeline.
//
// Announcements are NOT affected. Pausing processing while nominations keep
// being announced is the normal shape of this operation: it extends the bid
// window for auctions already open, and bid submission is gated only on
// restricted_free_agency_period_end, so teams can still bid throughout.
//
// Every outcome line is console.log rather than debug -- the output of this
// command IS the audit trail for a commissioner action, and a debug namespace
// is a runtime negotiation with the ESM import graph that an audit trail must
// not depend on winning.

const ET_FORMAT = 'YYYY-MM-DD HH:mm:ss [ET]'

const format_et = (value) => dayjs(value).tz(league_timezone).format(ET_FORMAT)

/**
 * Resolve the pause end from either a relative duration or an absolute
 * timestamp.
 *
 * Relative is the form an operator actually reaches for under time pressure
 * ("hold this for 12 hours"), and it cannot be wrong about the current time
 * the way a hand-typed absolute timestamp can. Absolute is kept because a
 * pause aimed at a known moment -- the next window opening, say -- is clearer
 * stated as that moment.
 *
 * @param {string} until - `12h` / `90m` / `2d`, or anything dayjs can parse
 * @returns {object} dayjs instance
 */
const resolve_pause_until = (until) => {
  const relative_match = String(until).match(/^(\d+)\s*(m|h|d)$/i)

  if (relative_match) {
    const amount = Number(relative_match[1])
    const unit = { m: 'minute', h: 'hour', d: 'day' }[
      relative_match[2].toLowerCase()
    ]
    return dayjs().add(amount, unit)
  }

  const parsed = dayjs(until)

  if (!parsed.isValid()) {
    throw new Error(
      `could not read --until "${until}" as a duration (12h, 90m, 2d) or a timestamp`
    )
  }

  return parsed
}

const get_season_row = async ({ lid, season_year }) => {
  const season_row = await db('seasons')
    .where({ lid, season_year })
    .select(
      'lid',
      'season_year',
      'restricted_free_agency_period_start',
      'restricted_free_agency_period_end',
      'restricted_free_agency_processing_paused_at',
      'restricted_free_agency_processing_paused_until',
      'restricted_free_agency_processing_paused_reason'
    )
    .first()

  if (!season_row) {
    throw new Error(`no seasons row for league ${lid} in ${season_year}`)
  }

  return season_row
}

const report_status = (season_row) => {
  const paused_at = season_row.restricted_free_agency_processing_paused_at
  const paused_until = season_row.restricted_free_agency_processing_paused_until
  const label = `league ${season_row.lid} (${season_row.season_year})`

  if (!paused_at) {
    console.log(`${label}: RFA bid processing is ACTIVE`)
    return
  }

  const is_elapsed = paused_until && dayjs(paused_until).isBefore(dayjs())
  const held_hours = (dayjs().diff(dayjs(paused_at), 'minute') / 60).toFixed(1)

  console.log(
    `${label}: RFA bid processing is ${
      is_elapsed ? 'ACTIVE (pause elapsed)' : 'PAUSED'
    } -- held ${held_hours}h since ${format_et(paused_at)}`
  )
  console.log(
    `  ends: ${
      paused_until ? format_et(paused_until) : 'when manually resumed'
    }`
  )
  console.log(
    `  reason: ${season_row.restricted_free_agency_processing_paused_reason}`
  )

  if (is_elapsed) {
    console.log(
      '  the elapsed pause needs no clearing -- processing already resumed on its own'
    )
  }
}

const pause_restricted_free_agency_processing = async ({
  lid,
  season_year = current_season.year,
  until,
  reason,
  resume = false,
  status = false
}) => {
  if (!lid) {
    throw new Error('--lid is required')
  }

  const season_row = await get_season_row({ lid, season_year })

  if (status) {
    report_status(season_row)
    return
  }

  if (resume) {
    if (!season_row.restricted_free_agency_processing_paused_at) {
      console.log(
        `league ${lid} (${season_year}): RFA bid processing was not paused -- nothing to do`
      )
      return
    }

    // All three columns move together: the rfa_processing_pause_states_a_reason
    // CHECK constraint refuses a reason or an expiry without a start, so a
    // resume that cleared only one of them would be rejected outright.
    await db('seasons').where({ lid, season_year }).update({
      restricted_free_agency_processing_paused_at: null,
      restricted_free_agency_processing_paused_until: null,
      restricted_free_agency_processing_paused_reason: null
    })

    const held_hours = (
      dayjs().diff(
        dayjs(season_row.restricted_free_agency_processing_paused_at),
        'minute'
      ) / 60
    ).toFixed(1)

    console.log(
      `league ${lid} (${season_year}): RFA bid processing RESUMED after ${held_hours}h`
    )
    console.log(
      '  every auction past its window processing time settles on the next run, in window order'
    )
    return
  }

  if (!reason) {
    throw new Error(
      '--reason is required -- it is the entire audit trail for this hold'
    )
  }

  // --until is OPTIONAL, and omitting it is the normal case. Resuming settles
  // bids irreversibly, so that step wants a human rather than a lapsed timer;
  // an end is set only when it is genuinely known ("hold until the next
  // window opens"). What surfaces a forgotten hold instead is the processing
  // job, which logs how long the league has been held on every run.
  const pause_until = until ? resolve_pause_until(until) : null

  if (pause_until && !pause_until.isAfter(dayjs())) {
    throw new Error(
      `--until resolves to ${format_et(pause_until)}, which is not in the future`
    )
  }

  // A pause outliving the period it protects is not wrong so much as
  // meaningless -- every auction settles or expires at period end regardless
  // -- so say so rather than silently accepting it.
  const period_end = season_row.restricted_free_agency_period_end
  // period_end is timestamptz as of the 2026-08-07 conformance pass, so it goes
  // straight into dayjs; Number() on it yields MILLISECONDS, which made this
  // comparison never true and printed the end date as a year-58,000 date.
  if (period_end && pause_until && pause_until.isAfter(period_end)) {
    console.log(
      `  note: the hold outlasts the restricted free agency period, which ends ` +
        `${format_et(period_end)}`
    )
  }

  await db('seasons')
    .where({ lid, season_year })
    .update({
      restricted_free_agency_processing_paused_at: dayjs().toISOString(),
      restricted_free_agency_processing_paused_until: pause_until
        ? pause_until.toISOString()
        : null,
      restricted_free_agency_processing_paused_reason: reason
    })

  console.log(
    `league ${lid} (${season_year}): RFA bid processing PAUSED -- ${
      pause_until
        ? `until ${format_et(pause_until)}`
        : 'open-ended, until you resume it'
    }`
  )
  console.log(`  reason: ${reason}`)

  if (!pause_until && period_end) {
    console.log(
      `  the hold cannot outlast the restricted free agency period, which ends ${format_et(
        period_end
      )}`
    )
  }

  console.log(
    `  resume with: node scripts/pause-restricted-free-agency-processing.mjs --lid=${lid} --resume`
  )
  console.log(
    '  announcements are unaffected, and teams can still submit and cancel bids'
  )
  console.log(
    '  the job keeps running and keeps reporting success, so its ledger row stays fresh'
  )
}

export default pause_restricted_free_agency_processing

const main = async () => {
  let exit_code = 0

  try {
    const argv = yargs(hideBin(process.argv))
      .option('lid', { type: 'number', describe: 'League id' })
      .option('season_year', {
        type: 'number',
        describe: 'Season year (defaults to the current season)'
      })
      .option('until', {
        type: 'string',
        describe:
          'Optional auto-expiry: a duration (12h, 90m, 2d) or a timestamp. ' +
          'Omit to hold until you resume it.'
      })
      .option('reason', { type: 'string', describe: 'Why processing is held' })
      .option('resume', { type: 'boolean', describe: 'Clear an active pause' })
      .option('status', {
        type: 'boolean',
        describe: 'Report the current pause state and exit'
      }).argv

    await pause_restricted_free_agency_processing({
      lid: argv.lid,
      season_year: argv.season_year || current_season.year,
      until: argv.until,
      reason: argv.reason,
      resume: argv.resume || false,
      status: argv.status || false
    })
  } catch (error) {
    console.error(`pause-restricted-free-agency-processing: ${error.message}`)
    exit_code = 1
  }

  await db.destroy()
  process.exit(exit_code)
}

if (is_main(import.meta.url)) {
  main()
}
