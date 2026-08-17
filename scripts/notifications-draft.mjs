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
  where_outstanding_draft_pick,
  throw_if_shortfall
} from '#libs-server'
import { getDraftWindow, get_draft_pass_window } from '#libs-shared'
import get_draft_window_config from '#libs-shared/get-draft-window-config.mjs'
import timestamptz_to_epoch from '#libs-shared/timestamptz-to-epoch.mjs'
import { get_open_league_pause } from '#libs-server/league-pause.mjs'
import { job_types } from '#libs-shared/job-constants.mjs'

const log = debug('notifications-draft')
debug.enable('notifications-draft')

const NOTIFICATION_TYPE_DRAFT_PICK_ON_CLOCK = 'draft_pick_on_clock'

const run = async () => {
  // One instant read two ways: draft_start and draft.selection_timestamp are
  // timestamptz as of the 2026-08-07 conformance pass, so the SQL comparison
  // takes the Date while the window math below stays epoch seconds.
  const now_instant = new Date()
  const now = timestamptz_to_epoch(now_instant)

  // Leagues whose draft has started (draft_start in the past). draft_start
  // lives on the seasons row, so a single left join carries it.
  const league_seasons = await db('leagues')
    .leftJoin('seasons', function () {
      this.on('leagues.uid', '=', 'seasons.lid')
      this.on(
        db.raw(
          `seasons.season_year = ${current_season.year} or seasons.season_year is null`
        )
      )
    })
    .whereNotNull('draft_start')
    .where('draft_start', '<', now_instant)

  const due_announcements = []

  for (const league_season of league_seasons) {
    const { lid } = league_season

    const league = await getLeague({ lid })

    // No team is on the clock while the league is paused -- the draft route is
    // behind the pause guard, so nobody could act on the announcement, and the
    // deadline it would quote is the uncredited one.
    const open_pause = await get_open_league_pause({ league_id: lid })
    if (open_pause) {
      log(`league ${lid}: LEAGUE PAUSED -- not announcing on-clock`)
      continue
    }

    // The pick actually on the clock is the lowest-numbered unmade pick: the
    // draft is sequential, so every earlier pick is already made. Deriving the
    // pick from elapsed time instead mis-fires whenever the real pace differs
    // from the clock (announces nothing in a fast draft, announces a future
    // pick in a stalled one), so we track the frontier directly.
    const frontier = await db('draft')
      .join('teams', 'draft.tid', 'teams.uid')
      .where('draft.season_year', current_season.year)
      .where('teams.season_year', current_season.year)
      .where('draft.lid', league.uid)
      .modify(where_outstanding_draft_pick, 'draft')
      .orderBy('draft.pick')
      .select('draft.pick', 'draft.tid', 'teams.name', 'teams.abbreviation')
      .first()

    if (!frontier) continue // draft complete for this league

    // The whole board, because it is what places a window: the published slate
    // indexes each pick by its position in the outstanding set as of the last
    // boundary, so a partial board mis-indexes every window on it.
    const draft_picks = await db('draft')
      .where({ lid: league.uid, season_year: current_season.year })
      .orderBy('pick', 'asc')

    // A pick goes on the clock at the START OF ITS OWN PUBLISHED WINDOW,
    // whether or not the pick ahead of it has been selected. This used to read
    // the preceding SELECTION instant instead, which was the pre-slate rule and
    // is now wrong in both directions: it announced a length measured from
    // whenever the last team happened to click, so a pick behind a multi-day
    // stall was told it had a window of a hundred hours when the slate gives it
    // one interval.
    const on_clock_window = getDraftWindow({
      ...get_draft_window_config(league),
      draft_picks,
      pick_number: frontier.pick
    })

    // Null between a resume and the next publication boundary, when the pick
    // has no window at all and so is not yet on the clock.
    if (!on_clock_window) {
      log(
        `league ${lid}: no published slate yet for pick #${frontier.pick}; skipping`
      )
      continue
    }

    const on_clock_at = on_clock_window.unix()

    if (on_clock_at > now) continue // the window has not opened yet

    // The idempotency key, and it is the WINDOW rather than anything about the
    // board on purpose. A pick still unmade at the next boundary is
    // republished onto an earlier slot, which is a new deadline its manager has
    // not been told; keying on the window re-announces it once per publication
    // rather than staying silent on the strength of yesterday's message.
    const event_timestamp = on_clock_at

    const already_sent = await has_league_notification_been_sent({
      lid,
      season_year: current_season.year,
      notification_type: NOTIFICATION_TYPE_DRAFT_PICK_ON_CLOCK,
      event_timestamp
    })
    if (already_sent) {
      log(
        `league ${lid}: on-clock notification already recorded for pick #${frontier.pick}; skipping`
      )
      continue
    }

    // The deadline is not a standalone setting: it is exactly the moment the
    // SECOND outstanding pick's slot opens, because that is when another team
    // may pass this one. Deriving it from the same calculator the draft route
    // gates on keeps the announced deadline and the enforced deadline from
    // drifting apart, and reports the real length across the overnight gap,
    // where a slot is worth more than an hour.
    //
    // `get_draft_pass_window` rather than the window of `frontier.pick + 1`:
    // on a board with a gap that names a pick that is already MADE — on the
    // live 2026 board the frontier is pick 3 and pick 4 is made — for which
    // the calculator correctly returns null, and `.unix()` on null throws.
    const pass_window = get_draft_pass_window({
      ...get_draft_window_config(league),
      draft_picks
    })

    // Null between a resume and the next publication boundary, when nobody can
    // pass this pick at all. Announcing no deadline is the honest report; the
    // next cycle picks it up once the slate publishes.
    if (!pass_window) {
      log(
        `league ${lid}: nobody can pass pick #${frontier.pick} (it is the last outstanding pick); skipping`
      )
      continue
    }

    const deadline = pass_window.unix()
    const clock_hours = Math.round(((deadline - on_clock_at) / 3600) * 10) / 10
    const message = `${frontier.name} (${frontier.abbreviation}) is now on the clock with the #${frontier.pick} pick in the ${current_season.year} draft. The window closes ${dayjs.unix(deadline).format('ddd MMM D h:mm A')} (${clock_hours} hours).`

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
      season_year: current_season.year,
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
      season_year: current_season.year,
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
