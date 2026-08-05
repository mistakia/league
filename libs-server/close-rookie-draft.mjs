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
 * @param {Object} args
 * @param {number} args.lid - League id.
 * @param {number} args.year - Draft year to close.
 * @param {number} [args.completed_at] - Unix seconds the draft closed. Ignored
 *   when the league-year already has a completion timestamp. Required when it
 *   does not.
 * @returns {Promise<{ timestamp: number, expired_count: number }>} `timestamp`
 *   is unix seconds, matching `seasons.rookie_draft_completed_at`. Note
 *   `draft.expired_at` is timestamptz and is written as a Date.
 */
export default async function close_rookie_draft({ lid, year, completed_at }) {
  const season = await db('seasons').where({ lid, season_year: year }).first()

  const existing = season?.rookie_draft_completed_at
  const timestamp = existing ? Number(existing) : completed_at

  if (!timestamp) {
    throw new Error(
      `unable to close rookie draft for league ${lid} year ${year}: no completion timestamp recorded and none supplied`
    )
  }

  let expired_count = 0

  await db.transaction(async (trx) => {
    if (!existing) {
      await trx('seasons')
        .where({ lid, season_year: year })
        .update({ rookie_draft_completed_at: timestamp })
    }

    expired_count = await trx('draft')
      .where({ lid, season_year: year })
      .whereNull('pid')
      .whereNull('expired_at')
      .update({ expired_at: new Date(timestamp * 1000) })
  })

  if (!existing || expired_count) {
    log(
      `closed rookie draft for league ${lid} year ${year} at ${timestamp}, expired ${expired_count} unused pick(s)`
    )
  }

  return { timestamp, expired_count }
}
