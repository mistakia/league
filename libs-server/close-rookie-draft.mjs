import debug from 'debug'

import db from '#db'

const log = debug('close-rookie-draft')
if (!process.env.DEBUG) {
  debug.enable('close-rookie-draft')
}

/**
 * Closes a league's rookie draft for one year: records when it ended and
 * expires every pick that was never used.
 *
 * Per the 2023-09-03 commissioner ruling an unused pick expires to free
 * agency at the close of the draft window — no compensation, no successor
 * asset. Recording that here, on the pick itself, is what lets every reader
 * distinguish a pick that is still owed a selection from one that is merely
 * unselected forever. See where-outstanding-draft-pick.mjs for the read side.
 *
 * Idempotent. A league-year that is already closed keeps its original
 * timestamp — a second call cannot move it — and re-stamping picks that
 * already carry `expired_at` is a no-op. This matters because two callers
 * race by design: the draft route closes the draft when the final pick is
 * made, and scripts/close-expired-rookie-drafts.mjs sweeps for drafts whose
 * window elapsed with picks still unmade. The second case is why this module
 * exists — before it, nothing closed an unfinished draft at all, so
 * `rookie_draft_completed_at` was populated for exactly one season and picks
 * from 2021 were still reading as tradeable five years later.
 *
 * @param {object} args
 * @param {number} args.lid - League id.
 * @param {number} args.year - Draft year to close.
 * @param {Date} [args.completed_at] - When the draft closed. Ignored when the
 *   league-year already has a completion timestamp. Required when it does not.
 * @returns {Promise<{ completed_at: Date, expired_count: number }>} Both
 *   `seasons.rookie_draft_completed_at` and `draft.expired_at` are timestamptz
 *   as of the 2026-08-07 conformance pass, so this is a Date throughout. It
 *   used to return unix seconds and coerce the column with `Number()`, which
 *   would now yield milliseconds.
 */
export default async function close_rookie_draft({ lid, year, completed_at }) {
  const season = await db('seasons').where({ lid, season_year: year }).first()

  const existing = season?.rookie_draft_completed_at
  const closed_at = existing || completed_at

  if (!closed_at) {
    throw new Error(
      `unable to close rookie draft for league ${lid} year ${year}: no completion timestamp recorded and none supplied`
    )
  }

  let expired_count = 0

  await db.transaction(async (trx) => {
    if (!existing) {
      await trx('seasons')
        .where({ lid, season_year: year })
        .update({ rookie_draft_completed_at: closed_at })
    }

    expired_count = await trx('draft')
      .where({ lid, season_year: year })
      .whereNull('pid')
      .whereNull('expired_at')
      .update({ expired_at: closed_at })
  })

  if (!existing || expired_count) {
    log(
      `closed rookie draft for league ${lid} year ${year} at ${closed_at.toISOString()}, expired ${expired_count} unused pick(s)`
    )
  }

  return { completed_at: closed_at, expired_count }
}
