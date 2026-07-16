import dayjs from 'dayjs'
import debug from 'debug'

import db from '#db'
import { current_season } from '#constants'
import {
  is_main,
  getLeague,
  report_job,
  has_league_notification_been_sent,
  record_league_notification_sent,
  throw_if_shortfall
} from '#libs-server'
import { job_types } from '#libs-shared/job-constants.mjs'

const log = debug('notifications-draft')
debug.enable('notifications-draft')

const NOTIFICATION_TYPE_DRAFT_PICK_ON_CLOCK = 'draft_pick_on_clock'

// The actual sendNotifications call is currently disabled (see TODO below).
// The record_league_notification_sent marker is the canonical "this pick was
// detected and announced" signal — when the notification implementation is
// restored it goes inside the same gate, and the oracle below validates the
// marker either way. event_timestamp is derived deterministically from
// draft_start and pick number so each slot has a unique, idempotent key
// within (lid, year, notification_type).
// 12-hour pick cadence (43200s) per the commissioner's 2026 draft-window
// election (governance-reference.md); halved from the prior 24-hour clock.
const get_pick_event_timestamp = ({ draft_start, pick_number }) =>
  draft_start + (pick_number - 1) * 43200

const run = async () => {
  // get lists of leagues after draft start date
  const now = dayjs().unix()
  const league_seasons = await db('leagues')
    .leftJoin('seasons', function () {
      this.on('leagues.uid', '=', 'seasons.lid')
      this.on(
        db.raw(`seasons.year = ${current_season.year} or seasons.year is null`)
      )
    })
    .whereNotNull('draft_start')
    .where('draft_start', '<', now)

  const due_announcements = []

  for (const league_season of league_seasons) {
    const { lid } = league_season
    const league = await getLeague({ lid })
    const draftStart = dayjs.unix(league_season.draft_start)
    const difference = dayjs().diff(draftStart, 'days')
    const pick_number = difference + 1

    const picks = await db('draft')
      .join('teams', 'draft.tid', 'teams.uid')
      .where('draft.year', current_season.year)
      .where('teams.year', current_season.year)
      .where('draft.pick', pick_number)
      .where('draft.lid', league.uid)
      .whereNull('draft.pid')

    if (!picks.length) continue

    const pick = picks[0]
    const event_timestamp = get_pick_event_timestamp({
      draft_start: league_season.draft_start,
      pick_number
    })

    const already_sent = await has_league_notification_been_sent({
      lid,
      year: current_season.year,
      notification_type: NOTIFICATION_TYPE_DRAFT_PICK_ON_CLOCK,
      event_timestamp
    })
    if (already_sent) {
      log(
        `league ${lid}: on-clock notification already recorded for pick #${pick.pick}; skipping`
      )
      continue
    }

    const message = `${pick.name} (${pick.abbrv}) is now on the clock with the #${pick.pick} pick in the ${pick.year} draft.`

    log(message)

    // TODO - outdated, needs updating

    /* await sendNotifications({
     *   league,
     *   teamIds: [pick.tid],
     *   message
     * }) */

    await record_league_notification_sent({
      lid,
      year: current_season.year,
      notification_type: NOTIFICATION_TYPE_DRAFT_PICK_ON_CLOCK,
      event_timestamp,
      message,
      metadata: { pick_number: pick.pick, tid: pick.tid }
    })

    due_announcements.push({ lid, event_timestamp, pick_number: pick.pick })
  }

  if (!due_announcements.length) {
    return { shortfall: null }
  }

  // Oracle: for every pick we detected this run, the marker must now exist.
  // A missing marker means we logged the announcement but the marker write
  // silently failed (e.g., db connection drop between log and insert) —
  // silent partial-success.
  const shortfalls = []
  for (const { lid, event_timestamp, pick_number } of due_announcements) {
    const marker_written = await has_league_notification_been_sent({
      lid,
      year: current_season.year,
      notification_type: NOTIFICATION_TYPE_DRAFT_PICK_ON_CLOCK,
      event_timestamp
    })
    if (!marker_written) {
      shortfalls.push(
        `league ${lid}: draft pick #${pick_number} on-clock notification announced but marker absent after run`
      )
    }
  }

  return { shortfall: shortfalls.length > 0 ? shortfalls.join('; ') : null }
}

const main = async () => {
  let error
  try {
    const result = await run()
    throw_if_shortfall(result?.shortfall)
  } catch (err) {
    error = err
    console.log(error)
  }

  await report_job({
    job_type: job_types.NOTIFICATIONS_DRAFT,
    error
  })

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default run
