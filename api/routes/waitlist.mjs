import express from 'express'
import rate_limit, { MemoryStore } from 'express-rate-limit'

import {
  commitment_affirmation_label,
  contact_fields,
  honeypot_field_name,
  manager_waitlist_questionnaire_version,
  questions
} from '#libs-shared/manager-waitlist-questions.mjs'

const router = express.Router()

// PUBLIC, UNAUTHENTICATED WRITE. This router carries the questionnaire submit
// route and NOTHING ELSE, and it is mounted before the blanket auth guard in
// api/index.mjs because a prospective manager has no account by definition.
//
// The read side deliberately lives in a SEPARATE router mounted AFTER that
// guard (api/routes/waitlist-submissions.mjs). Keeping them apart is the whole
// design: the two live privacy holes this repo has had were both a pre-guard
// route reading user-owned rows behind a hand-written `req.auth` predicate that
// was inverted for anonymous callers. A reader that cannot be reached without a
// token has no predicate to get wrong.
//
// The field list is IMPORTED rather than restated here. When it was a local
// constant it had to agree with the form's copy and with the table's columns by
// hand, which is three places to keep in step for a thing that gets edited
// between rounds.

// Deliberately loose. The email is a contact route the Commissioner will reply
// to by hand, not a login, so the only failure worth refusing is one that
// cannot be a mailbox at all -- and a strict pattern here rejects real
// addresses, which on a form whose scarce resource is COMPLETION costs more
// than it saves.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const SUBMISSIONS_PER_DAY = 5

// The store is constructed here and EXPORTED so the spec can reset it between
// cases. The alternative -- skipping the limiter under NODE_ENV=test -- would
// leave the one abuse control on a public write endpoint with no coverage at
// all, and it fails in the direction where the suite is green over a limiter
// that never runs. A resettable store keeps it live in the suite, so the 429
// path is exercised rather than assumed.
export const submit_rate_limit_store = new MemoryStore()

// Five submissions per IP per day. A candidate submits once; the second attempt
// is a correction and the third is already unusual. Note this is in-process
// memory, so a `pm2 reload` resets the window -- acceptable for a limit whose
// job is to bound automated volume rather than to enforce a quota.
const submit_rate_limiter = rate_limit({
  windowMs: 24 * 60 * 60 * 1000,
  limit: SUBMISSIONS_PER_DAY,
  store: submit_rate_limit_store,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many submissions from this address today' }
})

// Returns the trimmed value, or null when the field was absent or blank. An
// absent optional answer is stored as null rather than as an empty string so
// the reading surface can tell "left blank" from "answered with nothing"
// without a second convention.
const read_answer = (body, name) => {
  const raw = body[name]
  const value = typeof raw === 'string' ? raw.trim() : ''
  return value || null
}

/**
 * @swagger
 * /waitlist:
 *   post:
 *     summary: Submit a manager vetting questionnaire response
 *     description: |
 *       Public and unauthenticated. Accepts one prospective manager's answers
 *       to the vetting questionnaire, which feed the league's waiting-list
 *       ranking vote. Rate limited per IP.
 *
 *       The accepted body keys are the contact field columns plus one key per
 *       question id, both defined in
 *       libs-shared/manager-waitlist-questions.mjs. Question answers are stored
 *       in the `responses` jsonb column keyed by question id.
 *     tags:
 *       - Waitlist
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - candidate_name
 *               - contact_email
 *               - timezone_name
 *               - has_affirmed_commitment
 *             properties:
 *               candidate_name:
 *                 type: string
 *               contact_email:
 *                 type: string
 *               contact_handle:
 *                 type: string
 *               timezone_name:
 *                 type: string
 *               has_affirmed_commitment:
 *                 type: boolean
 *                 description: Must be true. The form states the commitment and takes an explicit affirmation rather than asking for it as a question.
 *     responses:
 *       200:
 *         description: The submission was recorded
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *       400:
 *         description: A required answer is missing, an answer is too long, or the commitment was not affirmed
 *       429:
 *         description: Too many submissions from this address
 */
router.post('/', submit_rate_limiter, async (req, res) => {
  const { logger } = req.app.locals
  try {
    // Answered honeypot: accept it as far as the caller can see. Telling a bot
    // which field gave it away is free information for the next attempt, and
    // there is no human on the other end to mislead.
    if (req.body[honeypot_field_name]) {
      return res.send({ success: true })
    }

    const submission = {
      questionnaire_version: manager_waitlist_questionnaire_version
    }

    for (const field of contact_fields) {
      const value = read_answer(req.body, field.column)

      if (!value) {
        if (field.required) {
          return res.status(400).send({ error: `Missing ${field.column}` })
        }
        submission[field.column] = null
        continue
      }

      if (value.length > field.max) {
        return res.status(400).send({ error: `${field.column} is too long` })
      }

      submission[field.column] = value
    }

    if (!EMAIL_RE.test(submission.contact_email)) {
      return res.status(400).send({ error: 'Invalid contact_email' })
    }

    // Strict `!== true` rather than a truthy check: the affirmation is the one
    // field where a caller sending the string 'false' must not be read as yes.
    if (req.body.has_affirmed_commitment !== true) {
      return res
        .status(400)
        .send({ error: `You must confirm: ${commitment_affirmation_label}` })
    }
    submission.has_affirmed_commitment = true

    const responses = {}
    for (const question of questions) {
      const value = read_answer(req.body, question.id)

      if (!value) {
        if (question.required) {
          return res.status(400).send({ error: `Missing ${question.id}` })
        }
        continue
      }

      // A question with `options` is a closed vocabulary, so the value has to
      // be one of them. Without this the select is only a client-side
      // suggestion -- anyone posting by hand could put arbitrary prose into a
      // field the managers' page presents as a comparable range, which is the
      // one thing these two questions exist to avoid.
      if (question.options) {
        if (!question.options.includes(value)) {
          return res
            .status(400)
            .send({ error: `${question.id} is not one of the choices` })
        }
        responses[question.id] = value
        continue
      }

      if (value.length > question.max) {
        return res.status(400).send({ error: `${question.id} is too long` })
      }

      responses[question.id] = value
    }

    // Only keys the current question set defines are stored. An unrecognised
    // key in the body is dropped rather than written through, so a stale client
    // -- or anyone posting by hand -- cannot put arbitrary content into a
    // schemaless column that the managers' page then renders.
    submission.responses = JSON.stringify(responses)

    await req.app.locals.db('manager_waitlist_submissions').insert(submission)

    // The response carries nothing but the acknowledgement. There is no read
    // path on this router by design, so there is no id to hand back and no
    // reason for an anonymous caller to hold one.
    res.send({ success: true })
  } catch (error) {
    logger(error)
    // 500, not 400. Nothing reaches this catch that the caller could have
    // caused -- every caller-caused refusal above returns before it -- and a
    // route whose catch-all maps its own failures to 4xx has no observable for
    // its own breakage.
    res.status(500).send({ error: error.message })
  }
})

export default router
