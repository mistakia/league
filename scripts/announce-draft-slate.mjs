// Posts the rookie draft's published slate to the league's announcements
// channel, once per publication.
//
// The window rule already decides everything this announces; nothing told the
// league about it. `notifications-draft.mjs` speaks only about the single pick
// on the clock, and its Discord send has been commented out since it was
// written -- so between the draft opening and this script the board was
// knowable only by loading the draft page and reading the countdowns. The
// 2026-08-12 window-jump dispute turned on exactly that gap: the commissioner's
// notice named a pick count instead of the rule, two teams were passed inside
// their own scheduled day, and the ruling recorded the notice as the one thing
// that went wrong.
//
// WHY THE PUBLICATION IS THE EVENT. The slate is frozen between two daily band
// closes (`libs-shared/draft-window/publication-boundaries.mjs`), so the close
// is the only instant at which the next day's board becomes both true and
// final. Announcing on any other trigger -- a selection, a fixed hour, the
// first window of the day -- either restates a board that has not changed or
// publishes one the next close is about to move. Keying the notification on the
// boundary also makes the once-only claim exact: one publication, one post.
//
// A resume is covered by construction rather than by a special case. It voids
// the standing publication, so the first close at or after it is a NEW
// boundary, and this posts the re-laid board without knowing a pause happened.
//
// The post goes to the ANNOUNCEMENTS channel, which is a different channel from
// the one `sendNotifications` writes to: `leagues.discord_webhook_url` points
// at transactions-and-events, where a per-pick "team X selected player Y" line
// belongs and a daily schedule would be buried. Hence the second per-league
// webhook column rather than a reuse of the first.

import debug from 'debug'
import dayjs from 'dayjs'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { current_season } from '#constants'
import { getDraftWindow, get_draft_pass_window } from '#libs-shared'
import get_draft_window_config from '#libs-shared/get-draft-window-config.mjs'
import {
  get_publication_boundary,
  get_next_publication_boundary
} from '#libs-shared/draft-window/publication-boundaries.mjs'
import {
  is_main,
  getLeague,
  report_job,
  claim_league_notification,
  has_league_notification_been_sent,
  where_outstanding_draft_pick,
  throw_if_shortfall
} from '#libs-server'
import send_discord_message from '#libs-server/send-discord-message.mjs'
import { get_open_league_pause } from '#libs-server/league-pause.mjs'
import { job_types } from '#libs-shared/job-constants.mjs'

const log = debug('announce-draft-slate')

export const NOTIFICATION_TYPE_DRAFT_SLATE = 'draft_slate_published'

const initialize_cli = () => yargs(hideBin(process.argv)).argv

const format_slot = (window_open_at) =>
  window_open_at.format('h:mm A').padStart(8, ' ')

// Discord does not reject a longer message, it SILENTLY truncates it, so a post
// that runs long loses its tail rather than failing.
export const DISCORD_MESSAGE_LIMIT = 2000

// How many stalled picks to name before the line becomes a count. Unbounded
// looked fine until it met the real board: a draft stalled since Aug 13 had 21
// outstanding picks already passable, which is a wall of names nobody reads and
// on a fuller board would have eaten the message limit on its own.
const MAX_NAMED_ALREADY_OPEN = 6

/**
 * The Discord post for one publication.
 *
 * Pure, and exported, because it is the part worth testing: the rest of this
 * script is a query, a claim and a fetch.
 *
 * `already_open` carries the outstanding picks whose window opened BEFORE this
 * publication -- stalled teams that anyone behind them may already pass. They
 * are named separately rather than folded into the day's list, because their
 * window is not a thing that happens tomorrow and printing a past time in a
 * schedule reads as an error.
 *
 * @param {Object} args
 * @param {number} args.season_year
 * @param {import('dayjs').Dayjs} args.slate_date - Any instant on the day the slots fall on.
 * @param {Array} args.slots - `{ pick_string, name, abbreviation, window_open_at }`, in pick order.
 * @param {Array} args.already_open - Same shape, for picks passable before this publication.
 * @param {Object|null} args.on_clock - `{ name, pick_string, pass_window }`, or null.
 * @returns {string}
 */
export const build_slate_message = (args) => {
  const message = compose_slate_message(args)
  if (message.length <= DISCORD_MESSAGE_LIMIT) return message

  // Over the limit, drop the optional sections rather than let Discord take
  // the tail. The schedule and the rule are what the post is FOR; the
  // already-passable roster and the on-clock line are context.
  const trimmed = compose_slate_message({
    ...args,
    already_open: [],
    on_clock: null
  })

  if (trimmed.length > DISCORD_MESSAGE_LIMIT) {
    throw new Error(
      `draft slate message is ${trimmed.length} characters with every optional section dropped, over Discord's ${DISCORD_MESSAGE_LIMIT} limit`
    )
  }

  return trimmed
}

const compose_slate_message = ({
  season_year,
  slate_date,
  slots,
  already_open = [],
  on_clock = null
}) => {
  const lines = [
    `**${season_year} rookie draft — windows for ${slate_date.format('dddd, MMMM D')}**`,
    '',
    '```',
    ...slots.map(
      (slot) =>
        `${format_slot(slot.window_open_at)}   ${slot.pick_string.padEnd(5, ' ')} ${slot.name} (${slot.abbreviation})`
    ),
    '```'
  ]

  if (already_open.length) {
    const named = already_open
      .slice(0, MAX_NAMED_ALREADY_OPEN)
      .map((slot) => `${slot.pick_string} ${slot.name}`)
      .join(', ')
    const remainder = already_open.length - MAX_NAMED_ALREADY_OPEN

    lines.push(
      '',
      remainder > 0
        ? `Already passable: ${named}, and ${remainder} more.`
        : `Already passable: ${named}.`
    )
  }

  if (on_clock) {
    lines.push(
      '',
      on_clock.pass_window
        ? `On the clock: ${on_clock.name} with ${on_clock.pick_string}. The first team that may go ahead of it selects from ${on_clock.pass_window.format('h:mm A on ddd MMM D')}.`
        : `On the clock: ${on_clock.name} with ${on_clock.pick_string}.`
    )
  }

  return lines.join('\n')
}

const NOTHING_DUE = { announced_boundary: null, is_missing_webhook: false }

/**
 * One league's publication, if it has one that has not been announced.
 *
 * Returns `{ announced_boundary, is_missing_webhook }`. The boundary is what
 * lets the caller assert a marker exists for every league it counted as due;
 * the flag is raised ONLY once every gate has passed and a post was actually
 * owed, so an unconfigured webhook is reported when it costs an announcement
 * rather than merely because a draft exists.
 */
export const announce_draft_slate = async ({ lid, dry_run = false }) => {
  const league = await getLeague({ lid })

  if (!league.draft_start) return NOTHING_DUE
  if (dayjs().isBefore(dayjs(league.draft_start))) return NOTHING_DUE

  const season = await db('seasons')
    .where({ lid, season_year: current_season.year })
    .first()

  if (season && season.rookie_draft_completed_at) {
    log(`league ${lid}: rookie draft already complete; skipping`)
    return NOTHING_DUE
  }

  // A paused league has no live board to publish and every write to it is
  // refused with a 423, so a schedule post would name windows nobody can act
  // on. The resume's own first close is the next boundary, and that one posts.
  const open_pause = await get_open_league_pause({ league_id: lid })
  if (open_pause) {
    log(`league ${lid}: LEAGUE PAUSED -- not announcing a slate`)
    return NOTHING_DUE
  }

  const window_config = get_draft_window_config(league)

  const boundary = get_publication_boundary(window_config)
  if (!boundary) {
    log(`league ${lid}: no publication governs yet; skipping`)
    return NOTHING_DUE
  }

  const draft_picks = await db('draft')
    .where({ lid, season_year: current_season.year })
    .orderBy('pick', 'asc')

  const outstanding = await db('draft')
    .join('teams', function () {
      this.on('draft.tid', '=', 'teams.team_id').andOn(
        'teams.season_year',
        '=',
        db.raw('?', [current_season.year])
      )
    })
    .where('draft.lid', lid)
    .where('draft.season_year', current_season.year)
    .modify(where_outstanding_draft_pick, 'draft')
    .orderBy('draft.pick', 'asc')
    .select(
      'draft.pick',
      'draft.pick_string',
      'draft.tid',
      'teams.name',
      'teams.abbreviation'
    )

  if (!outstanding.length) {
    log(`league ${lid}: no outstanding picks; skipping`)
    return NOTHING_DUE
  }

  // The close after this one. Everything the CURRENT publication placed inside
  // the coming day falls before it, and anything later belongs to a board this
  // post cannot honestly promise -- the next close re-lays it.
  const next_boundary = get_next_publication_boundary({
    until: boundary,
    daily_window_start_hour: window_config.daily_window_start_hour,
    daily_window_end_hour: window_config.daily_window_end_hour
  })

  const slots = []
  const already_open = []

  for (const pick_row of outstanding) {
    const window_open_at = getDraftWindow({
      ...window_config,
      draft_picks,
      pick_number: pick_row.pick,
      until: boundary
    })

    if (!window_open_at) continue

    const entry = { ...pick_row, window_open_at }

    if (window_open_at.isBefore(boundary)) already_open.push(entry)
    else if (window_open_at.isBefore(next_boundary)) slots.push(entry)
  }

  if (!slots.length) {
    log(`league ${lid}: no windows fall before the next publication; skipping`)
    return NOTHING_DUE
  }

  const frontier = outstanding[0]
  const pass_window = get_draft_pass_window({
    ...window_config,
    draft_picks,
    until: boundary
  })

  const message = build_slate_message({
    season_year: current_season.year,
    slate_date: slots[0].window_open_at,
    slots,
    already_open,
    on_clock: {
      name: frontier.name,
      pick_string: frontier.pick_string,
      pass_window
    }
  })

  if (dry_run) {
    log(`league ${lid}: DRY RUN, boundary ${boundary.format()}`)
    console.log(message)
    return NOTHING_DUE
  }

  // The webhook is checked HERE, after every gate, because this is the first
  // point at which its absence costs anything: a league with a live draft and
  // no announcements webhook would otherwise go dark forever with a clean exit
  // code. Checking it earlier would red the job every ten minutes for a paused
  // league, or one with nothing to announce, which is noise rather than news.
  if (!league.discord_announcements_webhook_url) {
    log(
      `league ${lid}: slate is due for ${boundary.format()} but no announcements webhook is configured`
    )
    return { announced_boundary: null, is_missing_webhook: true }
  }

  // Claim before sending. A duplicate schedule post to the whole league is the
  // failure this is designed against, and the read-then-write pair cannot
  // prevent one -- see `claim_league_notification`. A send failure after the
  // claim is therefore loud rather than retried.
  const claimed = await claim_league_notification({
    lid,
    season_year: current_season.year,
    notification_type: NOTIFICATION_TYPE_DRAFT_SLATE,
    event_timestamp: boundary.unix(),
    message,
    metadata: {
      pick_numbers: slots.map((slot) => slot.pick),
      boundary: boundary.toISOString()
    }
  })

  if (!claimed) {
    log(`league ${lid}: slate for ${boundary.format()} already announced`)
    return NOTHING_DUE
  }

  // The claim is already written, so nothing will retry this post -- which
  // makes an UNVERIFIED send the worst shape available here. `fetch` resolves a
  // 404 from a stale webhook exactly like a 204, so without reading the result
  // a permanently lost announcement is recorded as delivered.
  const { is_sent } = await send_discord_message({
    discord_webhook_url: league.discord_announcements_webhook_url,
    message
  })

  if (!is_sent) {
    throw new Error(
      `league ${lid}: Discord refused the slate post for ${boundary.format()}; the notification is claimed, so this publication will NOT be retried`
    )
  }

  log(`league ${lid}: announced slate for ${boundary.format()}`)

  return { announced_boundary: boundary.unix(), is_missing_webhook: false }
}

const process_all_leagues = async ({ dry_run = false } = {}) => {
  const leagues = await db('leagues')
    .join('seasons', function () {
      this.on('leagues.league_id', '=', 'seasons.lid').andOn(
        'seasons.season_year',
        '=',
        db.raw('?', [current_season.year])
      )
    })
    .whereNotNull('seasons.draft_start')
    .where('seasons.draft_start', '<', new Date())
    .whereNull('seasons.rookie_draft_completed_at')
    .select('leagues.league_id')

  const announced = []
  const shortfalls = []

  for (const league of leagues) {
    const { announced_boundary, is_missing_webhook } =
      await announce_draft_slate({ lid: league.league_id, dry_run })

    // A league that posts nothing to Discord is not misconfigured, it just does
    // not use the channel — so this is raised by the announcer only once a post
    // was actually owed, never merely because a draft is open.
    if (is_missing_webhook) {
      shortfalls.push(
        `league ${league.league_id}: a draft slate was due but discord_announcements_webhook_url is unset -- the announcement did not reach anyone`
      )
    }

    if (announced_boundary) {
      announced.push({
        lid: league.league_id,
        boundary_timestamp: announced_boundary
      })
    }
  }

  // Oracle: every league this run announced for must now carry its marker. A
  // missing one means the claim was reported and the row is not there --
  // silent partial success, and the next run would post the same slate again.
  for (const { lid, boundary_timestamp } of announced) {
    const marker_written = await has_league_notification_been_sent({
      lid,
      season_year: current_season.year,
      notification_type: NOTIFICATION_TYPE_DRAFT_SLATE,
      event_timestamp: boundary_timestamp
    })

    if (!marker_written) {
      shortfalls.push(
        `league ${lid}: draft slate announced for boundary ${boundary_timestamp} but notification marker absent after run`
      )
    }
  }

  return { shortfall: shortfalls.length > 0 ? shortfalls.join('; ') : null }
}

const main = async () => {
  let error
  const argv = initialize_cli()
  // yargs camel-case-expands `--dry-run` to `dryRun`, so accepting only
  // `dry_run` would run the script live on the conventional spelling.
  const dry_run = Boolean(argv.dry_run || argv.dryRun)

  try {
    if (argv.lid) {
      await announce_draft_slate({ lid: Number(argv.lid), dry_run })
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
      job_type: job_types.ANNOUNCE_DRAFT_SLATE,
      error
    })
  }

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default announce_draft_slate
