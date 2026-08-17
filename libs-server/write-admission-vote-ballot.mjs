import db from '#db'

/**
 * Write one Team's ballot in an Amendment XLIII Admission Vote, replacing any
 * ballot that Team already had.
 *
 * ONE TRANSACTION, and the replacement case is why. These writers autocommit
 * statement by statement, so a delete-then-insert that throws in between leaves
 * a Team with no ballot at all -- silent disenfranchisement, discovered only if
 * someone notices the tally came out one short. The preference rows cascade
 * from the ballot row, so removing the ballot removes the prior ranking with
 * it and there is no window in which half a ranking is stored.
 *
 * Keyed on `team_id`, never on `user_id`, so a Team carrying two userids gets
 * one ballot.
 *
 * This writes; it does not judge. Every rule the schema cannot enforce -- the
 * ballot period, the eligibility snapshot, the bound on how many Candidates may
 * be ranked, and the three refusals around a transcribed ballot -- belongs to
 * the caller, which is api/routes/admission-votes.mjs.
 *
 * @param {Object} args
 * @param {number} args.admission_vote_id
 * @param {number} args.team_id
 * @param {Array<number>} args.ranked_candidate_ids - In preference order; the
 *   first element becomes `preference_rank` 1.
 * @param {string|null} [args.commissioner_entered_reason] - Null means the
 *   Manager cast it himself. Non-null states why the Commissioner transcribed
 *   it, which is one column rather than a flag plus a reason that could
 *   disagree with it.
 * @param {Date} [args.submitted_at]
 */
export default async function write_admission_vote_ballot({
  admission_vote_id,
  team_id,
  ranked_candidate_ids,
  commissioner_entered_reason = null,
  submitted_at = new Date()
}) {
  await db.transaction(async (trx) => {
    await trx('admission_vote_ballots')
      .where({ admission_vote_id, team_id })
      .del()

    await trx('admission_vote_ballots').insert({
      admission_vote_id,
      team_id,
      submitted_at,
      commissioner_entered_reason
    })

    await trx('admission_vote_ballot_preferences').insert(
      ranked_candidate_ids.map((admission_vote_candidate_id, index) => ({
        admission_vote_id,
        team_id,
        admission_vote_candidate_id,
        preference_rank: index + 1
      }))
    )
  })
}
