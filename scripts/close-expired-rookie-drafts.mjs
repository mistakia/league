import debug from 'debug'

import db from '#db'
import { current_season } from '#constants'
import {
  is_main,
  report_job,
  close_rookie_draft,
  where_outstanding_draft_pick,
  throw_if_shortfall
} from '#libs-server'
import { getDraftDates } from '#libs-shared'
import { get_open_league_pause } from '#libs-server/league-pause.mjs'
import { job_types } from '#libs-shared/job-constants.mjs'
import { enable_debug_namespaces } from '#libs-shared/enable-debug-namespaces.mjs'

const log = debug('close-expired-rookie-drafts')
enable_debug_namespaces('close-expired-rookie-drafts')

/**
 * Closes any rookie draft whose window has elapsed while picks were still
 * unmade, expiring those picks per the 2023-09-03 commissioner ruling.
 *
 * This is the path that did not exist before 2026-08-05. The draft route only
 * ever recorded completion when the FINAL pick was made, which a draft with
 * abandoned picks never satisfies — so those drafts were never closed, and
 * their picks read as live tradeable assets indefinitely. Four picks from 2021
 * and 2023 were still showing on a team page in August 2026 because of it.
 *
 * Self-gating and cheap: leagues with no outstanding picks in a closed window
 * cost one grouped query. Idempotent, because close_rookie_draft is.
 */
const run = async () => {
  // Candidate league-years: anything still carrying an outstanding pick. A
  // year with none is already fully resolved and needs no window arithmetic.
  const candidates = await db('draft')
    .select('lid', 'season_year')
    .modify(where_outstanding_draft_pick)
    .whereNotNull('season_year')
    .groupBy('lid', 'season_year')

  const closed = []

  for (const { lid, season_year: year } of candidates) {
    // A draft whose year is still ahead of us has not opened, let alone
    // closed. Guarding here keeps the window projection off future endowments,
    // which carry no pick numbers at all.
    if (year > current_season.year) continue

    // THIS SKIP IS WHAT PROTECTS THE DRAFT'S HARD END. The end is now an
    // announced column rather than a projection, so nothing about a pause moves
    // it: a league paused across its own hard end would have every unmade pick
    // expired on schedule, which is the outcome the pause exists to prevent.
    // Extending the end for a pause is a commissioner act -- an UPDATE to
    // seasons.rookie_draft_end_at -- and this skip is what holds the board
    // still until someone makes it.
    //
    // (The comment here used to blame getDraftDates quantizing to endOf('day'),
    // which was never the mechanism: the open-seconds credit never reached the
    // end at all, because getDraftDates did not read the pause periods.)
    const open_pause = await get_open_league_pause({ league_id: lid })
    if (open_pause) {
      log(`league ${lid}: LEAGUE PAUSED -- not expiring unmade draft picks`)
      continue
    }

    const season = await db('seasons').where({ lid, season_year: year }).first()

    // Read from the season row for THIS year, not from `league` — `getLeague`
    // resolves the current season, and this loop walks every year with an
    // outstanding pick.
    const { draftEnd } = getDraftDates({
      rookie_draft_end_at: season?.rookie_draft_end_at ?? null,
      rookie_draft_completed_at: season?.rookie_draft_completed_at ?? null
    })

    // A season with no hard end has no draft configured, so there is nothing
    // to close.
    if (!draftEnd) continue

    if (!current_season.now.isAfter(draftEnd)) continue // still open

    const { completed_at, expired_count } = await close_rookie_draft({
      lid,
      year,
      completed_at: draftEnd.toDate()
    })

    if (expired_count) {
      log(
        `league ${lid} year ${year}: expired ${expired_count} unused pick(s) at ${completed_at.toISOString()}`
      )
      closed.push({ lid, year, expired_count })
    }
  }

  if (!closed.length) {
    return { shortfall: null }
  }

  // Oracle: every league-year we just closed must now hold zero outstanding
  // picks. A survivor means the update reported rows but did not persist them,
  // or a concurrent write re-opened one — silent partial success, which the
  // exit code cannot distinguish from a clean run.
  const shortfalls = []
  for (const { lid, year, expired_count } of closed) {
    const survivors = await db('draft')
      .where({ lid, season_year: year })
      .modify(where_outstanding_draft_pick)
      .count('* as count')
      .first()

    if (Number(survivors.count) !== 0) {
      shortfalls.push(
        `league ${lid} year ${year}: closed and expired ${expired_count} pick(s) but ${survivors.count} remain outstanding`
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
    job_type: job_types.CLOSE_EXPIRED_ROOKIE_DRAFTS,
    error
  })

  process.exit(error ? 1 : 0)
}

if (is_main(import.meta.url)) {
  main()
}

export default run
