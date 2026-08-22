// THE DELETION ROUTE FOR SUBMISSION CONTENT.
//
// A submission body is written by a member of the public into a free-text box.
// It carries whatever they chose to put there -- an email address, a real name,
// a screenshot of their own account -- so a queue with no deletion path is a
// personally-identifying store that grows forever. This is that path.
//
// REDACTION, NOT DELETION, and the distinction is the whole design. The row and
// its contribution_events trail survive: a submission that produced a shipped
// fix is referenced by a task entity and possibly a merged pull request, and
// hard-deleting it would leave those pointing at nothing while destroying the
// audit trail of work already done. What is destroyed is the content -- body,
// captured context, screenshot -- which is the part that carries the person.
//
// The title is redacted too. It is free text the submitter typed, and treating
// it as a safe summary because it is short is how "Bug on my account
// alice@example.com" survives a purge.

import fs from 'fs/promises'

export const PURGED_BODY_PLACEHOLDER = '[purged at submitter request]'
export const PURGED_TITLE_PLACEHOLDER = '[purged]'

// Returns { purged: true } on success, { purged: false, reason } when the row
// does not exist or was already purged. Idempotent by construction: a second
// call finds purged_at set and returns without rewriting it, so the timestamp
// records the FIRST purge rather than the most recent call.
export default async function purge_submission({
  db,
  submission_id,
  logger = null
}) {
  const submission = await db('contribution_submissions')
    .where({ submission_id })
    .first('submission_id', 'screenshot_reference', 'purged_at')

  if (!submission) {
    return { purged: false, reason: 'not_found' }
  }

  if (submission.purged_at) {
    return { purged: false, reason: 'already_purged' }
  }

  // The stored image goes first and its failure is NON-FATAL. If the file
  // cannot be removed -- already gone, or a permission fault -- the database
  // redaction must still happen: a row whose body survives because an unlinked
  // file threw is the worst of both outcomes. The orphaned file is logged and
  // the reference is cleared regardless, which is also why the file is unlinked
  // BEFORE the reference is dropped rather than after. Dropping the reference
  // first and then failing to unlink would leave a file on disk that nothing
  // records the existence of.
  if (submission.screenshot_reference) {
    try {
      await fs.unlink(submission.screenshot_reference)
    } catch (error) {
      if (error.code !== 'ENOENT' && logger) {
        logger(error)
      }
    }
  }

  const purged_at = new Date()

  await db.transaction(async (trx) => {
    await trx('contribution_submissions').where({ submission_id }).update({
      submission_title: PURGED_TITLE_PLACEHOLDER,
      submission_body: PURGED_BODY_PLACEHOLDER,
      captured_context: null,
      screenshot_reference: null,
      purged_at,
      updated_at: purged_at
    })

    // Answers are submitter-authored free text on the same footing as the body,
    // so they are redacted with it. The QUESTION rows are template-drawn and
    // carry no submitter content, so they stay -- they are what makes the
    // remaining trail legible.
    const question_ids = await trx('contribution_questions')
      .where({ submission_id })
      .pluck('question_id')

    if (question_ids.length) {
      await trx('contribution_answers')
        .whereIn('question_id', question_ids)
        .update({ answer_body: PURGED_BODY_PLACEHOLDER })
    }

    // The purge is itself a state change, so it writes an event like every
    // other one. event_context deliberately records only that a purge happened
    // -- putting a copy of what was purged in here would defeat the purge.
    await trx('contribution_events').insert({
      submission_id,
      contribution_event_type: 'submission_purged',
      event_context: JSON.stringify({ reason: 'submitter_request' })
    })
  })

  return { purged: true }
}
