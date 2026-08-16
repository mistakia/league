/**
 * Section 10(b) scoring for an Amendment XLIII Admission Vote.
 *
 *   "The Candidate a Team ranks first receives points equal to the number of
 *    Candidates, the Candidate it ranks second one (1) fewer, and so on. A
 *    Candidate whom a Team does not rank receives no points from that Team."
 *
 * Points are pegged to `maximum_ranked_candidates` from the vote row, NEVER to
 * how many Candidates a Team actually ranked. A Team that ranks two must not
 * give its favourite less weight than a Team that ranks six, so a short ballot
 * scores its first preference at the full value.
 *
 * The column name predates the 2026-08-16 amendment change that removed the
 * Commissioner-stated cap. There is no stated maximum now: the API derives this
 * value from the candidate count, so it IS the number of Candidates that
 * Section 10(b) names.
 *
 * Pure and synchronous. The caller supplies the rows; this decides only what
 * they are worth, which is what makes the two edge cases -- a short ballot and
 * a rank beyond the candidate count -- checkable without a database.
 *
 * That bound is also why a rank beyond it is tolerated here rather than thrown
 * on. The submit route enforces it, so such a row should not exist; if one ever
 * does, Section 10(b) says in terms what it is worth, and scoring it at zero is
 * that answer rather than an exception that would strand a whole tally.
 *
 * @param {Object} args
 * @param {Array<{admission_vote_candidate_id: number, preference_rank: number}>} args.preferences
 *   Every preference row in the vote, across every Team's ballot.
 * @param {number} args.maximum_ranked_candidates - The number of Candidates in
 *   the vote, from the vote row.
 * @param {Array<number>} [args.admission_vote_candidate_ids] - Every Candidate
 *   in the vote. Supplying them is what puts an entirely unranked Candidate in
 *   the result at zero rather than leaving him absent, which Section 10(d)
 *   needs -- the disclosure is the points recorded for EACH Candidate.
 * @returns {Map<number, number>} Points by candidate id.
 */
export default function calculate_admission_vote_points({
  preferences = [],
  maximum_ranked_candidates,
  admission_vote_candidate_ids = []
}) {
  if (
    !Number.isInteger(maximum_ranked_candidates) ||
    maximum_ranked_candidates < 1
  ) {
    throw new Error(
      `maximum_ranked_candidates must be an integer of at least 1, received ${maximum_ranked_candidates}`
    )
  }

  const points_by_candidate = new Map()

  for (const admission_vote_candidate_id of admission_vote_candidate_ids) {
    points_by_candidate.set(admission_vote_candidate_id, 0)
  }

  for (const { admission_vote_candidate_id, preference_rank } of preferences) {
    if (!points_by_candidate.has(admission_vote_candidate_id)) {
      points_by_candidate.set(admission_vote_candidate_id, 0)
    }

    if (preference_rank > maximum_ranked_candidates) {
      continue
    }

    points_by_candidate.set(
      admission_vote_candidate_id,
      points_by_candidate.get(admission_vote_candidate_id) +
        (maximum_ranked_candidates - preference_rank + 1)
    )
  }

  return points_by_candidate
}
