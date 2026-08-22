import express from 'express'
import rate_limit, { MemoryStore } from 'express-rate-limit'
import { randomBytes, createHash, timingSafeEqual } from 'crypto'

import resolve_trust_tier from '#libs-server/contribution/resolve-trust-tier.mjs'

const router = express.Router()

// PUBLIC, UNAUTHENTICATED WRITE, mounted ABOVE the blanket auth guard in
// api/index.mjs. That placement is the admission model, not a convenience:
// /data-views and /plays render with no session and are where most breakage is
// seen, so an authenticated-only report path excludes exactly the visitors who
// hit the most bugs.
//
// What authentication buys is AUTONOMY, not admission. Every submission is
// stored; submission_trust_tier decides whether it may enter the automated
// planning path without the operator ruling on it, and that enforcement lives
// in the base-side poller rather than here. This router's job is to admit,
// classify and store.
//
// THE OWNERSHIP PREDICATE HAZARD. This repository has had two live privacy
// holes and both were the same shape: a pre-guard route whose ownership check
// read as TRUE for a caller with no credential. Every read route below is
// written so that an absent credential returns BEFORE the row is disclosed --
// the list route 401s on !req.auth explicitly rather than querying with an
// undefined user id, and the detail route requires either a matching author or
// a claim token that dereferences to exactly one row. Neither has a predicate
// that can invert to "everyone".

export const ANONYMOUS_SUBMISSIONS_PER_DAY = 5
export const AUTHENTICATED_SUBMISSIONS_PER_DAY = 20
export const ANSWERS_PER_DAY = 30

export const MINIMUM_TITLE_LENGTH = 8
export const MINIMUM_BODY_LENGTH = 20
export const MAXIMUM_TITLE_LENGTH = 200
export const MAXIMUM_BODY_LENGTH = 10000
export const MAXIMUM_ANSWER_LENGTH = 4000

// 256 KB, matching the check constraint on contribution_submissions.
// captured_context. Enforced HERE as well so an oversized payload is refused
// with a 400 naming the problem rather than surfacing as a constraint violation
// the caller cannot act on.
export const MAXIMUM_CAPTURED_CONTEXT_BYTES = 262144

export const SUBMISSION_KINDS = Object.freeze(['bug_report', 'feature_idea'])

// The statuses that mean "waiting on the submitter", and therefore the only two
// an incoming answer returns to `received`. Every other status is a disposition
// somebody already made.
export const RESURFACEABLE_SUBMISSION_STATUSES = Object.freeze([
  'awaiting_information',
  'expired'
])

// Stores are constructed here and EXPORTED so the spec can reset them between
// cases, following api/routes/waitlist.mjs. Disabling the limiters under
// NODE_ENV=test would leave the only abuse control on a public write surface
// with no coverage, failing in the direction where the suite is green over a
// limiter that never runs.
//
// TWO STORES, because the lanes bound different things. Sharing one would let
// anonymous volume from a shared NAT exhaust the budget of an authenticated
// submitter who has done nothing.
export const anonymous_submit_rate_limit_store = new MemoryStore()
export const authenticated_submit_rate_limit_store = new MemoryStore()
export const answer_rate_limit_store = new MemoryStore()

const build_rate_limiter = ({ limit, store, message, key_generator }) =>
  rate_limit({
    windowMs: 24 * 60 * 60 * 1000,
    limit,
    store,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: message },
    ...(key_generator ? { keyGenerator: key_generator } : {})
  })

// The anonymous lane keys on IP via the library's DEFAULT generator, which is
// deliberate: express-rate-limit v7 normalises IPv6 into a /56 subnet there, so
// a single client cannot walk its own address space to get a fresh budget per
// request. Writing `req.ip` by hand here would reintroduce exactly that hole.
const anonymous_submit_rate_limiter = build_rate_limiter({
  limit: ANONYMOUS_SUBMISSIONS_PER_DAY,
  store: anonymous_submit_rate_limit_store,
  message: 'Too many reports from this address today'
})

// The authenticated lane keys on the user id instead, so a submitter behind a
// shared address is budgeted as themselves. Registration is invite-code gated
// (api/routes/auth.mjs), which is what makes a user id worth more than an IP.
const authenticated_submit_rate_limiter = build_rate_limiter({
  limit: AUTHENTICATED_SUBMISSIONS_PER_DAY,
  store: authenticated_submit_rate_limit_store,
  message: 'Too many reports from this account today'
})

// express-slow-down, which this repository already applies to /api/stats,
// /api/plays, /api/markets and /api/u, is NOT sufficient for this route. Its
// configuration DELAYS a caller and never refuses one, so an anonymous flood
// still lands, just slower. A submission endpoint needs a hard refusal, which
// is why these are express-rate-limit. That package is already a direct
// dependency (^7.5.1) -- the planning document recorded it as absent and was
// stale -- so this introduces nothing new.
const submit_rate_limiter = (req, res, next) =>
  (req.auth?.userId
    ? authenticated_submit_rate_limiter
    : anonymous_submit_rate_limiter)(req, res, next)

const answer_rate_limiter = build_rate_limiter({
  limit: ANSWERS_PER_DAY,
  store: answer_rate_limit_store,
  message: 'Too many answers from this address today'
})

// THE ANONYMOUS SUBMITTER'S ONLY ROUTE BACK. They have no account to scope a
// list to, so the claim token IS their identity for exactly one row.
//
// Returned once, in the create response, and never again -- there is no resend
// path, because there is no address to resend to. Stored as a sha256 digest so
// a leak of this table does not hand over every submitter's body and captured
// context.
const mint_claim_token = () => randomBytes(32).toString('base64url')

export const hash_claim_token = (token) =>
  createHash('sha256').update(token).digest('hex')

// Constant-time compare on the DIGESTS rather than a SQL lookup keyed on the
// hash. Both are 64-char hex of known equal length, so the length guard below
// is about malformed input rather than about leaking length.
const is_claim_token_match = (presented_token, stored_hash) => {
  if (!presented_token || !stored_hash) return false
  const presented_hash = Buffer.from(hash_claim_token(presented_token), 'utf8')
  const expected_hash = Buffer.from(stored_hash, 'utf8')
  if (presented_hash.length !== expected_hash.length) return false
  return timingSafeEqual(presented_hash, expected_hash)
}

// The token travels in a header rather than the query string. A query parameter
// lands in access logs, in Referer headers on any outbound link, and in browser
// history; this is a bearer credential for one submitter's report.
const read_claim_token = (req) => req.get('x-contribution-claim-token') || null

const read_text_field = (value) =>
  typeof value === 'string' ? value.trim() : ''

// MINIMUM-SUBSTANCE VALIDATION, mirrored client-side so the refusal is not a
// round trip. The floor is deliberately low: the scarce resource on a report
// form is COMPLETION, and a strict rule rejects real reports. This refuses an
// empty box and a single character, not a terse but genuine report.
const read_submission_from_body = (body) => {
  const submission_kind = read_text_field(body.submission_kind)
  const submission_title = read_text_field(body.submission_title)
  const submission_body = read_text_field(body.submission_body)

  if (!SUBMISSION_KINDS.includes(submission_kind)) {
    return { error: 'submission_kind must be bug_report or feature_idea' }
  }

  if (submission_title.length < MINIMUM_TITLE_LENGTH) {
    return {
      error: `submission_title must be at least ${MINIMUM_TITLE_LENGTH} characters`
    }
  }

  if (submission_title.length > MAXIMUM_TITLE_LENGTH) {
    return {
      error: `submission_title must be at most ${MAXIMUM_TITLE_LENGTH} characters`
    }
  }

  if (submission_body.length < MINIMUM_BODY_LENGTH) {
    return {
      error: `submission_body must be at least ${MINIMUM_BODY_LENGTH} characters`
    }
  }

  if (submission_body.length > MAXIMUM_BODY_LENGTH) {
    return {
      error: `submission_body must be at most ${MAXIMUM_BODY_LENGTH} characters`
    }
  }

  // captured_context is a TRIAGE AID and never a submission precondition. A
  // client whose manifest fetch failed or whose shortener call was refused
  // sends a partial object, and that must still submit. Only a structurally
  // wrong value -- a non-object, or one over the column's ceiling -- is refused.
  let captured_context = null
  if (body.captured_context !== undefined && body.captured_context !== null) {
    if (
      typeof body.captured_context !== 'object' ||
      Array.isArray(body.captured_context)
    ) {
      return { error: 'captured_context must be an object' }
    }
    const serialized = JSON.stringify(body.captured_context)
    if (
      Buffer.byteLength(serialized, 'utf8') > MAXIMUM_CAPTURED_CONTEXT_BYTES
    ) {
      return {
        error: `captured_context must be at most ${MAXIMUM_CAPTURED_CONTEXT_BYTES} bytes`
      }
    }
    captured_context = body.captured_context
  }

  return {
    submission: {
      submission_kind,
      submission_title,
      submission_body,
      captured_context
    }
  }
}

/**
 * @swagger
 * /contributions:
 *   post:
 *     summary: File a bug report or feature idea
 *     description: |
 *       Open to anonymous callers. An anonymous submission is stored with
 *       submission_trust_tier `untrusted` and receives a claim token, returned
 *       exactly once, which is the only route back to the submission.
 *     tags:
 *       - Contributions
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [submission_kind, submission_title, submission_body]
 *             properties:
 *               submission_kind:
 *                 type: string
 *                 enum: [bug_report, feature_idea]
 *               submission_title:
 *                 type: string
 *               submission_body:
 *                 type: string
 *               captured_context:
 *                 type: object
 *                 nullable: true
 *     responses:
 *       200:
 *         description: The stored submission
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [submission_id, submission_status, submission_trust_tier]
 *               properties:
 *                 submission_id:
 *                   type: string
 *                 submission_status:
 *                   type: string
 *                 submission_trust_tier:
 *                   type: string
 *                 claim_token:
 *                   type: string
 *                   nullable: true
 *       400:
 *         description: Missing or malformed fields
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       429:
 *         description: Too many submissions
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/', submit_rate_limiter, async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const { submission, error } = read_submission_from_body(req.body)

    if (error) {
      return res.status(400).send({ error })
    }

    const submitter_user_id = req.auth?.userId ?? null
    const submission_trust_tier = await resolve_trust_tier({
      db,
      submitter_user_id
    })

    // The token is minted for an anonymous submitter ONLY. An authenticated one
    // reaches their submission through the list route, so issuing them a bearer
    // credential as well would be a second, weaker way into the same row for no
    // gain.
    const claim_token = submitter_user_id ? null : mint_claim_token()

    const [row] = await db.transaction(async (trx) => {
      const inserted = await trx('contribution_submissions')
        .insert({
          submitter_user_id,
          submission_trust_tier,
          submission_kind: submission.submission_kind,
          submission_title: submission.submission_title,
          submission_body: submission.submission_body,
          captured_context: submission.captured_context
            ? JSON.stringify(submission.captured_context)
            : null,
          claim_token_hash: claim_token ? hash_claim_token(claim_token) : null
        })
        .returning([
          'submission_id',
          'submission_status',
          'submission_trust_tier'
        ])

      // NOTHING MUTATES A SUBMISSION WITHOUT AN EVENT. Creation is a state
      // change like any other, and writing it inside the same transaction is
      // what makes that true rather than aspirational -- a row cannot exist
      // with no event, because the insert and the event commit together.
      await trx('contribution_events').insert({
        submission_id: inserted[0].submission_id,
        contribution_event_type: 'submission_created',
        new_submission_status: inserted[0].submission_status,
        event_context: JSON.stringify({
          submission_trust_tier,
          is_authenticated: Boolean(submitter_user_id)
        })
      })

      return inserted
    })

    return res.send({
      submission_id: row.submission_id,
      submission_status: row.submission_status,
      submission_trust_tier: row.submission_trust_tier,
      // Shown once, on the confirmation, with the honest warning that it is the
      // only way back.
      claim_token
    })
  } catch (error) {
    logger(error)
    return res.status(500).send({ error: error.toString() })
  }
})

/**
 * @swagger
 * /contributions:
 *   get:
 *     summary: List the authenticated submitter's own submissions
 *     tags:
 *       - Contributions
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: The submitter's submissions, newest first
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    // EXPLICIT, and the reason this route is safe to mount above the blanket
    // guard. Falling through to a query keyed on an undefined user id is the
    // exact shape of both privacy holes this repository has had: knex would
    // drop the predicate and return every submitter's rows.
    if (!req.auth?.userId) {
      return res.status(401).send({ error: 'Authentication required' })
    }

    const submissions = await db('contribution_submissions')
      .where({ submitter_user_id: req.auth.userId })
      .orderBy('submitted_at', 'desc')
      .select(
        'submission_id',
        'submission_kind',
        'submission_title',
        'submission_status',
        'autonomy_class',
        'pull_request_number',
        'submitted_at',
        'updated_at'
      )

    return res.send(submissions)
  } catch (error) {
    logger(error)
    return res.status(500).send({ error: error.toString() })
  }
})

// Resolves the submission a caller is entitled to read, or null. The two
// admission routes are deliberately the only two: the authenticated author, and
// the bearer of the claim token minted at create.
const authorize_submission_read = async ({ db, req, submission_id }) => {
  const submission = await db('contribution_submissions')
    .where({ submission_id })
    .first()

  if (!submission) return null

  if (submission.submitter_user_id) {
    return req.auth?.userId === submission.submitter_user_id ? submission : null
  }

  return is_claim_token_match(
    read_claim_token(req),
    submission.claim_token_hash
  )
    ? submission
    : null
}

/**
 * @swagger
 * /contributions/{submission_id}:
 *   get:
 *     summary: Read one submission with its question and answer thread
 *     description: |
 *       Readable by the authenticated author, or by a caller presenting the
 *       claim token in the `x-contribution-claim-token` header. An
 *       unauthorized caller receives 404, not 403.
 *     tags:
 *       - Contributions
 *     parameters:
 *       - in: path
 *         name: submission_id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: The submission
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       404:
 *         description: No such submission, or the caller may not read it
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/:submission_id', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const submission = await authorize_submission_read({
      db,
      req,
      submission_id: req.params.submission_id
    })

    // 404 RATHER THAN 403, deliberately. A 403 confirms the submission exists,
    // which turns this route into an oracle for enumerating other people's
    // report identifiers. The caller who legitimately holds a token cannot tell
    // the difference; the caller guessing identifiers learns nothing.
    if (!submission) {
      return res.status(404).send({ error: 'Submission not found' })
    }

    const questions = await db('contribution_questions')
      .where({ submission_id: submission.submission_id })
      .leftJoin(
        'contribution_answers',
        'contribution_questions.question_id',
        'contribution_answers.question_id'
      )
      .orderBy('asked_at', 'asc')
      .select(
        'contribution_questions.question_id',
        'contribution_questions.question_text',
        'contribution_questions.expires_at',
        'contribution_answers.answer_body',
        'contribution_answers.answered_at'
      )

    // claim_token_hash is never returned. It is a credential digest, and the
    // detail response is the one place a careless `select *` would ship it.
    return res.send({
      submission_id: submission.submission_id,
      submission_kind: submission.submission_kind,
      submission_title: submission.submission_title,
      submission_body: submission.submission_body,
      submission_status: submission.submission_status,
      autonomy_class: submission.autonomy_class,
      pull_request_number: submission.pull_request_number,
      submitted_at: submission.submitted_at,
      updated_at: submission.updated_at,
      purged_at: submission.purged_at,
      questions
    })
  } catch (error) {
    logger(error)
    return res.status(500).send({ error: error.toString() })
  }
})

/**
 * @swagger
 * /contributions/{submission_id}/answers:
 *   post:
 *     summary: Answer a follow-up question on a submission
 *     tags:
 *       - Contributions
 *     parameters:
 *       - in: path
 *         name: submission_id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [question_id, answer_body]
 *             properties:
 *               question_id:
 *                 type: string
 *               answer_body:
 *                 type: string
 *     responses:
 *       200:
 *         description: The answer was recorded
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [success]
 *               properties:
 *                 success:
 *                   type: boolean
 *       400:
 *         description: Missing or malformed fields
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: No such submission or question, or the caller may not answer it
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       409:
 *         description: |
 *           The question was already answered. An EXPIRED question is still
 *           answerable — a late answer is recorded and resurfaces a parked or
 *           expired submission back into the triage queue.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post(
  '/:submission_id/answers',
  answer_rate_limiter,
  async (req, res) => {
    const { db, logger } = req.app.locals
    try {
      // The same authorization as the read. Answering is a write on a submission,
      // so it cannot be looser than being allowed to see it.
      const submission = await authorize_submission_read({
        db,
        req,
        submission_id: req.params.submission_id
      })

      if (!submission) {
        return res.status(404).send({ error: 'Submission not found' })
      }

      const question_id = read_text_field(req.body.question_id)
      const answer_body = read_text_field(req.body.answer_body)

      if (!question_id) {
        return res.status(400).send({ error: 'question_id is required' })
      }

      if (!answer_body) {
        return res.status(400).send({ error: 'answer_body is required' })
      }

      if (answer_body.length > MAXIMUM_ANSWER_LENGTH) {
        return res.status(400).send({
          error: `answer_body must be at most ${MAXIMUM_ANSWER_LENGTH} characters`
        })
      }

      // Scoped to THIS submission. Without the submission_id predicate a caller
      // holding one valid claim token could answer any question in the table by
      // naming its identifier.
      const question = await db('contribution_questions')
        .where({ question_id, submission_id: submission.submission_id })
        .first()

      if (!question) {
        return res.status(404).send({ error: 'Question not found' })
      }

      // AN EXPIRED QUESTION IS STILL ANSWERABLE, deliberately. Expiry exists so
      // a parked submission stops holding a queue slot -- it is a statement
      // about OUR attention, not about the submitter's welcome. Refusing a late
      // answer would throw away the one thing that makes the report actionable,
      // from the one person who can supply it, at the exact moment they came
      // back. So the answer is recorded and the submission RESURFACES below.
      //
      // The bound that makes this safe is on the asking side, not here: at most
      // three questions ever exist per submission
      // (user-base extension/contribution/request-information.mjs), so a late
      // answer can resurface a submission at most three times.

      const existing_answer = await db('contribution_answers')
        .where({ question_id })
        .first('answer_id')

      if (existing_answer) {
        return res
          .status(409)
          .send({ error: 'This question has already been answered' })
      }

      await db.transaction(async (trx) => {
        await trx('contribution_answers').insert({ question_id, answer_body })

        // An answer is what moves a submission back into the queue, so it is a
        // state change and writes an event. The status only moves from the two
        // statuses that MEAN "waiting on the submitter" -- an answer to an
        // already-triaged, rejected or shipped submission is recorded without
        // reopening it, because a late answer is information, not a veto over a
        // disposition already made.
        //
        // `expired` is in the set for the same reason the expiry check above was
        // removed: the sweep that set it was reclaiming a queue slot, and the
        // submitter answering is exactly the event that earns the slot back.
        //
        // A PURGED submission never resurfaces regardless of status. Its body
        // and captured context are gone, so returning it to the queue would put
        // a row triage cannot read back in front of a human.
        const is_resurfaceable =
          RESURFACEABLE_SUBMISSION_STATUSES.includes(
            submission.submission_status
          ) && !submission.purged_at

        if (is_resurfaceable) {
          await trx('contribution_submissions')
            .where({ submission_id: submission.submission_id })
            .update({ submission_status: 'received', updated_at: new Date() })
        }

        await trx('contribution_events').insert({
          submission_id: submission.submission_id,
          contribution_event_type: 'answer_received',
          previous_submission_status: submission.submission_status,
          new_submission_status: is_resurfaceable
            ? 'received'
            : submission.submission_status,
          event_context: JSON.stringify({
            question_id,
            is_late_answer: new Date(question.expires_at) < new Date()
          })
        })
      })

      return res.send({ success: true })
    } catch (error) {
      logger(error)
      return res.status(500).send({ error: error.toString() })
    }
  }
)

export default router
