import debug from 'debug'

import db from '#db'
import { current_season } from '#constants'
import {
  is_main,
  getLeague,
  report_job,
  close_rookie_draft,
  where_outstanding_draft_pick,
  throw_if_shortfall
} from '#libs-server'
import { getDraftDates } from '#libs-shared'
import get_draft_window_config from '#libs-shared/get-draft-window-config.mjs'
import { job_types } from '#libs-shared/job-constants.mjs'

const log = debug('close-expired-rookie-drafts')
if (!process.env.DEBUG) {
  debug.enable('close-expired-rookie-drafts')
}

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
    .select('lid', 'year')
    .modify(where_outstanding_draft_pick)
    .whereNotNull('year')
    .groupBy('lid', 'year')

  const closed = []

  for (const { lid, year } of candidates) {
    // A draft whose year is still ahead of us has not opened, let alone
    // closed. Guarding here keeps the window projection off future endowments,
    // which carry no pick numbers at all.
    if (year > current_season.year) continue

    const league = await getLeague({ lid })
    if (!league) {
      log(`league ${lid}: not found; skipping`)
      continue
    }

    const season = await db('seasons').where({ lid, year }).first()

    const last_pick = await db('draft')
      .where({ lid, year })
      .whereNotNull('pick')
      .orderBy('pick', 'desc')
      .first()

    const last_selection = await db('draft')
      .where({ lid, year })
      .whereNotNull('selection_timestamp')
      .orderBy('selection_timestamp', 'desc')
      .first()

    const { draftEnd } = getDraftDates({
      ...get_draft_window_config(league),
      total_picks: last_pick?.pick,
      last_selection_timestamp: last_selection?.selection_timestamp ?? null,
      rookie_draft_completed_at: season?.rookie_draft_completed_at ?? null
    })

    if (!current_season.now.isAfter(draftEnd)) continue // still open

    const { timestamp, expired_count } = await close_rookie_draft({
      lid,
      year,
      completed_at: draftEnd.unix()
    })

    if (expired_count) {
      log(
        `league ${lid} year ${year}: expired ${expired_count} unused pick(s) at ${timestamp}`
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
      .where({ lid, year })
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

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default run
