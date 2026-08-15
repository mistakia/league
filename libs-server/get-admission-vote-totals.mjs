import db from '#db'

import { admission_vote_statuses } from '#libs-shared/constants/admission-vote-constants.mjs'

/**
 * The Section 10(e) disclosure: "the number of points recorded for each
 * Candidate", ranked by most points.
 *
 * Two properties are decisions rather than defaults.
 *
 * SEALING IS A STATUS CHECK, NOT A PERMISSION CHECK. An open vote returns an
 * empty array to every caller, the Commissioner included. Nothing here consults
 * who is asking, so there is no ownership predicate to invert -- the same
 * structural argument that makes the waitlist-submissions route safe. The
 * caller still has to gate on membership; that is a separate question this
 * function deliberately cannot answer.
 *
 * THIS IS THE ONLY READ PATH ONTO THE TALLY, and it selects from
 * `admission_vote_candidates` alone. Section 10(e) forbids disclosing how a
 * Team voted, so no per-Team row can reach a caller through here: the ballot
 * and preference tables are not joined, and there is no argument that would
 * make them be. Reaching an individual ballot takes a deliberate query against
 * the database, which is what the comments on those two tables say in terms.
 *
 * The ordering IS the Section 11 ranking -- most points first -- so the
 * Commissioner's staged Candidate is the first row and the Section 11(c) tie is
 * visible as two rows sharing a total. `candidate_name` breaks the tie only for
 * display stability; ranking WITHIN a tie is the Commissioner's own
 * determination, not this ORDER BY's.
 *
 * @param {Object} args
 * @param {number} args.admission_vote_id
 * @returns {Promise<Array<{admission_vote_candidate_id: number, candidate_name: string, points_total: number}>>}
 *   Empty while the vote is open, or where no such vote exists.
 */
export default async function get_admission_vote_totals({ admission_vote_id }) {
  const vote = await db('admission_votes')
    .select('vote_status')
    .where({ admission_vote_id })
    .first()

  if (!vote || vote.vote_status !== admission_vote_statuses.CLOSED) {
    return []
  }

  return db('admission_vote_candidates')
    .select('admission_vote_candidate_id', 'candidate_name', 'points_total')
    .where({ admission_vote_id })
    .orderBy('points_total', 'desc')
    .orderBy('candidate_name', 'asc')
}
