import db from '#db'
import { roster_slot_types, transaction_types } from '#constants'

/**
 * The practice squad designation a player held on a team, derived from that
 * team's transaction log.
 *
 * Amendment XXXIV section 16 returns a successful super priority claim to the
 * practice squad "(drafted or signed)" -- the designation the player held
 * before the poach, not one derived from how the claim happened to be
 * processed. Protection (PSP/PSDP) is a separate election the team makes each
 * time and is not restored, so this returns only the unprotected slots.
 *
 * Read from `transactions` rather than from roster history, which is not
 * reliably present: process-poach deletes the original team's `rosters_players`
 * rows for `week >= current_season.week`, so a player signed and poached inside
 * one week leaves no surviving roster row to read. The three add types below are
 * the same ones process-super-priority walks to recover the restored salary, so
 * the slot and the salary are drawn from one row and cannot describe different
 * histories.
 *
 * DRAFT is the only add that puts a player on the practice squad as DRAFTED.
 * PRACTICE_ADD is a signing, and ROSTER_DEACTIVATE demotes an active player who
 * was never drafted onto the practice squad -- both are signed designations.
 * Taking the most recent of the three is what makes a drafted rookie later
 * activated and demoted come back signed, which is the designation they last
 * held.
 *
 * @param {object} params
 * @param {string} params.pid
 * @param {number} params.tid - the team whose transaction log is read
 * @param {number} params.lid
 * @returns {Promise<number|null>} `roster_slot_types.PS`,
 *   `roster_slot_types.PSD`, or null when the team has no practice squad add
 *   for this player
 */
export default async function get_original_practice_squad_designation({
  pid,
  tid,
  lid
}) {
  const last_add = await db('transactions')
    .where({ pid, tid, lid })
    .whereIn('type', [
      transaction_types.PRACTICE_ADD,
      transaction_types.DRAFT,
      transaction_types.ROSTER_DEACTIVATE
    ])
    .orderBy('occurred_at', 'desc')
    .orderBy('transaction_id', 'desc')
    .first()

  if (!last_add) {
    return null
  }

  return last_add.type === transaction_types.DRAFT
    ? roster_slot_types.PSD
    : roster_slot_types.PS
}
