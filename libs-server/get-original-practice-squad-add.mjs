import db from '#db'
import { roster_slot_types, transaction_types } from '#constants'

/**
 * The practice squad add a player last held on a team, as the slot to restore
 * and the salary to restore it at.
 *
 * Amendment XXXIV section 16 returns a successful super priority claim to the
 * practice squad "(drafted or signed)" at their original Practice Squad Salary
 * -- the designation and the salary the player held before the poach, not ones
 * derived from how the claim happened to be processed. Protection (PSP/PSDP) is
 * a separate election the team makes each time and is not restored, so this
 * returns only the unprotected slots.
 *
 * Read from `transactions` rather than from roster history, which is not
 * reliably present: process-poach deletes the original team's `rosters_players`
 * rows for `week >= current_season.week`, so a player signed and poached inside
 * one week leaves no surviving roster row to read.
 *
 * SLOT AND SALARY COME OFF ONE ROW, and that is the point of returning both
 * from here rather than letting each caller walk the log for its own half. They
 * were two queries until 2026-08-30, and only one of them carried the
 * `transaction_id` tiebreaker below -- so on an `occurred_at` tie they could
 * select different rows and describe different histories, restoring one add's
 * slot at another add's salary. Production had no such tie, which is exactly why
 * it would have gone unnoticed. Adding a caller that needs only one half is not
 * a reason to split it again.
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
 * @returns {Promise<{slot: number, player_salary: number}|null>} The slot to
 *   restore (`roster_slot_types.PS` or `roster_slot_types.PSD`) and the salary
 *   to restore it at, or null when the team has no practice squad add for this
 *   player. A null is the caller's to refuse: there is no add to restore, so
 *   there is no designation and no salary to give the player back.
 */
export default async function get_original_practice_squad_add({
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

  return {
    slot:
      last_add.type === transaction_types.DRAFT
        ? roster_slot_types.PSD
        : roster_slot_types.PS,
    player_salary: last_add.player_salary
  }
}
