import dayjs from 'dayjs'

import db from '#db'
import calculate_admission_vote_points from './calculate-admission-vote-points.mjs'
import {
  admission_vote_statuses,
  admission_vote_decision_period_days
} from '#libs-shared/constants/admission-vote-constants.mjs'

/**
 * Closes an Amendment XLIII Admission Vote: pins each Candidate's point total,
 * marks the vote closed, and starts the Section 11(a) seven-day decision clock.
 *
 * `points_total` is derivable from the retained preference rows, so pinning it
 * is not about recovering the number -- it is about fixing what the decision
 * was actually made on. A later change to the scoring rule can then not rewrite
 * what the Commissioner saw. `decision_due_at` is pinned at the same moment and
 * for the same reason: a later change to the seven-day period cannot
 * retroactively re-judge a past vote.
 *
 * The deemed pass is derived rather than written. Section 11(a) makes it the
 * ABSENCE of an act -- `decision_outcome` null past `decision_due_at` IS the
 * deemed pass -- so nothing here schedules anything and no job has to run for a
 * Vacancy to stop being stranded.
 *
 * All three writes are one transaction. These writers otherwise autocommit
 * statement by statement, and a throw between the candidate updates and the
 * vote update would leave a closed vote whose totals were half written, or an
 * open vote carrying pinned totals a reader would take for final.
 *
 * Closing before `closes_at` is permitted -- the Commissioner may press close
 * early. It deliberately widens nothing, because the transcription refusal in
 * the submit route keys on `closes_at` rather than on this act.
 *
 * @param {Object} args
 * @param {number} args.admission_vote_id
 * @param {Date} [args.closed_at] - When the vote closed. Defaults to now.
 * @returns {Promise<{closed_at: Date, decision_due_at: Date, points_by_candidate: Map<number, number>}>}
 */
export default async function close_admission_vote({
  admission_vote_id,
  closed_at = new Date()
}) {
  const vote = await db('admission_votes').where({ admission_vote_id }).first()

  if (!vote) {
    throw new Error(`admission vote ${admission_vote_id} does not exist`)
  }

  // Not idempotent, deliberately. A second close would recompute the totals and
  // move the decision deadline, which is exactly the history-rewriting that
  // pinning them exists to prevent.
  if (vote.vote_status === admission_vote_statuses.CLOSED) {
    throw new Error(`admission vote ${admission_vote_id} is already closed`)
  }

  const candidates = await db('admission_vote_candidates')
    .select('admission_vote_candidate_id')
    .where({ admission_vote_id })

  const preferences = await db('admission_vote_ballot_preferences')
    .select('admission_vote_candidate_id', 'preference_rank')
    .where({ admission_vote_id })

  const points_by_candidate = calculate_admission_vote_points({
    preferences,
    maximum_ranked_candidates: vote.maximum_ranked_candidates,
    admission_vote_candidate_ids: candidates.map(
      (candidate) => candidate.admission_vote_candidate_id
    )
  })

  // Day arithmetic on a plain Date, so no timezone plugin and no DST offset is
  // in play -- seven days is 168 hours here, and the column is timestamptz.
  const decision_due_at = dayjs(closed_at)
    .add(admission_vote_decision_period_days, 'day')
    .toDate()

  await db.transaction(async (trx) => {
    for (const [
      admission_vote_candidate_id,
      points_total
    ] of points_by_candidate) {
      await trx('admission_vote_candidates')
        .where({ admission_vote_candidate_id })
        .update({ points_total })
    }

    await trx('admission_votes').where({ admission_vote_id }).update({
      vote_status: admission_vote_statuses.CLOSED,
      closed_at,
      decision_due_at
    })
  })

  return { closed_at, decision_due_at, points_by_candidate }
}
