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

// Fallback only — the window length is data-driven from seasons.draft_pick_clock_hours.
const DEFAULT_PICK_CLOCK_HOURS = 24

const run = async () => {
  const now = dayjs().unix()

  // Leagues whose draft has started (draft_start in the past). draft_start and
  // the per-season pick clock (draft_pick_clock_hours) both live on the
  // seasons row, so a single left join carries the configured window length.
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
    const { lid, draft_start } = league_season
    const clock_hours =
      league_season.draft_pick_clock_hours || DEFAULT_PICK_CLOCK_HOURS
    const clock_seconds = clock_hours * 3600

    const league = await getLeague({ lid })

    // The pick actually on the clock is the lowest-numbered unmade pick: the
    // draft is sequential, so every earlier pick is already made. Deriving the
    // pick from elapsed time instead mis-fires whenever the real pace differs
    // from the clock (announces nothing in a fast draft, announces a future
    // pick in a stalled one), so we track the frontier directly.
    const frontier = await db('draft')
      .join('teams', 'draft.tid', 'teams.uid')
      .where('draft.year', current_season.year)
      .where('teams.year', current_season.year)
      .where('draft.lid', league.uid)
      .whereNull('draft.pid')
      .orderBy('draft.pick')
      .select('draft.pick', 'draft.tid', 'teams.name', 'teams.abbrv')
      .first()

    if (!frontier) continue // draft complete for this league

    // The window opens the instant the previous pick is made (draft_start for
    // pick 1), per Article XI Section 8. That timestamp is the true on-clock
    // time and doubles as the stable, unique idempotency key for this pick.
    let on_clock_at = draft_start
    if (frontier.pick > 1) {
      const previous = await db('draft')
        .where({
          lid: league.uid,
          year: current_season.year,
          pick: frontier.pick - 1
        })
        .first()
      on_clock_at = previous?.selection_timestamp || draft_start
    }

    if (on_clock_at > now) continue // window has not opened yet

    const event_timestamp = on_clock_at

    const already_sent = await has_league_notification_been_sent({
      lid,
      year: current_season.year,
      notification_type: NOTIFICATION_TYPE_DRAFT_PICK_ON_CLOCK,
      event_timestamp
    })
    if (already_sent) {
      log(
        `league ${lid}: on-clock notification already recorded for pick #${frontier.pick}; skipping`
      )
      continue
    }

    const deadline = on_clock_at + clock_seconds
    const message = `${frontier.name} (${frontier.abbrv}) is now on the clock with the #${frontier.pick} pick in the ${current_season.year} draft. The ${clock_hours}-hour window closes ${dayjs.unix(deadline).format('ddd MMM D h:mm A')}.`

    log(message)

    // TODO - notification send is disabled; restore it inside this gate so it
    // shares the once-only marker below.

    /* await sendNotifications({
     *   league,
     *   teamIds: [frontier.tid],
     *   message
     * }) */

    await record_league_notification_sent({
      lid,
      year: current_season.year,
      notification_type: NOTIFICATION_TYPE_DRAFT_PICK_ON_CLOCK,
      event_timestamp,
      message,
      metadata: {
        pick_number: frontier.pick,
        tid: frontier.tid,
        on_clock_at,
        deadline,
        clock_hours
      }
    })

    due_announcements.push({ lid, event_timestamp, pick_number: frontier.pick })
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
