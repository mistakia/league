import express from 'express'
import jwt from 'jsonwebtoken'
import rate_limit, { MemoryStore } from 'express-rate-limit'
import { createHmac } from 'crypto'

import { sendEmail } from '#libs-server'
import {
  commitment_affirmation_label,
  contact_fields,
  honeypot_field_name,
  manager_waitlist_questionnaire_version,
  questions
} from '#libs-shared/manager-waitlist-questions.mjs'

const router = express.Router()

// PUBLIC, UNAUTHENTICATED WRITE. This router carries the routes a prospective
// manager reaches with no account -- submitting the questionnaire, and coming
// back to correct what he submitted -- and it is mounted before the blanket
// auth guard in api/index.mjs for that reason.
//
// THE INVARIANT THAT REPLACED "SUBMIT AND NOTHING ELSE". Everything here except
// the submit POST requires a signed single-purpose EDIT TOKEN, which names one
// submission and is delivered only to the address on that submission. So a
// caller with no token still reaches no row: there is no `req.auth` predicate
// anywhere on this router, and the two live privacy holes this repo has had
// were both a pre-guard route whose ownership predicate was inverted for
// anonymous callers. A token that dereferences to exactly one row has nothing
// to invert -- absent it, the handler returns before it queries.
//
// The MANAGERS' read side is still a separate router mounted AFTER the guard
// (api/routes/waitlist-submissions.mjs), and stays there: it returns every
// candidate's PII to a league member, which is a different question from a
// candidate reaching his own answers.
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

// THE ONE SPELLING OF AN ADDRESS. Every address is lowercased before it is
// stored and before it is looked up, through this single function, because the
// two paths silently disagreeing is unrecoverable for the candidate rather than
// merely wrong: POST /waitlist/edit-link answers identically whether or not it
// found a row, so somebody who applied as `Kia@Example.com` and later asks for
// his link as `kia@example.com` is told the link is on its way, gets no mail,
// and has no way to find out why. Mail domains are case-insensitive and mobile
// keyboards capitalise the first letter, so this is an ordinary path, not an
// adversarial one.
//
// Normalising on WRITE rather than comparing case-insensitively on read keeps
// the column directly indexable -- a `lower(contact_email)` predicate would not
// use a plain index, and this table had no index on the column at all.
const normalize_email = (value) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value

export const SUBMISSIONS_PER_DAY = 5
export const EDIT_LINK_REQUESTS_PER_DAY = 5
export const EDITS_PER_DAY = 20

// Each store is constructed here and EXPORTED so the spec can reset it between
// cases. The alternative -- skipping the limiters under NODE_ENV=test -- would
// leave the only abuse controls on a public write surface with no coverage at
// all, and it fails in the direction where the suite is green over a limiter
// that never runs. A resettable store keeps them live in the suite, so the 429
// paths are exercised rather than assumed.
//
// THREE STORES RATHER THAN ONE, because the three budgets bound different
// things and sharing a store would make them interact in a way no caller could
// predict: a candidate who submitted five times would find himself unable to
// ask for the link that lets him stop submitting.
export const submit_rate_limit_store = new MemoryStore()
export const edit_link_rate_limit_store = new MemoryStore()
export const edit_rate_limit_store = new MemoryStore()

const build_rate_limiter = ({ limit, store, message }) =>
  rate_limit({
    windowMs: 24 * 60 * 60 * 1000,
    limit,
    store,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: message }
  })

// Five submissions per IP per day. A candidate submits once; the second attempt
// is a correction and the third is already unusual. Note this is in-process
// memory, so a `pm2 reload` resets the window -- acceptable for a limit whose
// job is to bound automated volume rather than to enforce a quota.
const submit_rate_limiter = build_rate_limiter({
  limit: SUBMISSIONS_PER_DAY,
  store: submit_rate_limit_store,
  message: 'Too many submissions from this address today'
})

// The link request is the one route here that sends mail to an address the
// caller chose, so its budget bounds how much mail one address can aim at
// somebody else's inbox rather than how much a candidate can do.
const edit_link_rate_limiter = build_rate_limiter({
  limit: EDIT_LINK_REQUESTS_PER_DAY,
  store: edit_link_rate_limit_store,
  message: 'Too many link requests from this address today'
})

// Higher than the submit budget on purpose: an edit is a correction, and
// somebody fixing typos in five long answers should not be refused halfway.
// It is still bounded, because a leaked link is a write credential.
const edit_rate_limiter = build_rate_limiter({
  limit: EDITS_PER_DAY,
  store: edit_rate_limit_store,
  message: 'Too many edits from this address today'
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

// THE EDIT TOKEN. A signed JWT naming one submission, and nothing is persisted
// for it -- the emailed link is the only thing that presents it, which is the
// shape POST /auth/reset-password already uses here.
//
// It carries a PURPOSE and is refused without it. Every other token in this
// system is signed with the same secret (a session token is `{ userId }`), so
// without this a login token would verify here and the only question left would
// be whether its payload happened to carry a submission_id. Deliberately NO
// EXPIRY: the row itself is the lifetime, since the table is emptied when the
// recruiting round closes, and a link that dies while the round is still open
// would strand exactly the candidate it was sent to.
const EDIT_TOKEN_PURPOSE = 'waitlist_edit'

const sign_edit_token = ({ config, submission_id }) =>
  jwt.sign({ submission_id, purpose: EDIT_TOKEN_PURPOSE }, config.jwt.secret)

// Returns the submission id the token names, or null for anything else -- an
// absent token, a forged one, a session token, a token for another purpose.
// One return value for every failure because the caller has nothing useful to
// tell the holder of a bad token apart from the holder of no token.
const read_edit_token = ({ config, token }) => {
  if (typeof token !== 'string' || !token) {
    return null
  }

  try {
    const payload = jwt.verify(token, config.jwt.secret, {
      algorithms: config.jwt.algorithms
    })

    if (payload.purpose !== EDIT_TOKEN_PURPOSE) {
      return null
    }

    const submission_id = Number(payload.submission_id)
    return Number.isInteger(submission_id) ? submission_id : null
  } catch (error) {
    return null
  }
}

// Mails the candidate his own edit link, and returns whether the provider took
// it. Failures are logged and swallowed by every caller: the submission is
// already written by the time this runs, and a 500 would tell a candidate who
// has just spent ten minutes on the form that it did not go through.
//
// ACCEPTED IS NOT DELIVERED. Resend taking the message is all this can learn --
// a bounce arrives later over a webhook nothing here receives -- so what the
// caller may report is that the link was sent, never that it landed.
const send_edit_link = async ({ config, submission }) => {
  const token = sign_edit_token({
    config,
    submission_id: submission.submission_id
  })
  const edit_link = `${config.url}/waitlist?token=${token}`

  // THE SUBJECT NAMES THE APPLICATION, which is what stops Gmail collapsing
  // links for DIFFERENT applications into one conversation. Gmail threads on
  // subject plus participants, and every message here shares a sender and a
  // recipient, so a fixed subject put every link a candidate ever received into
  // a single thread -- measured against a real mailbox, three messages, one
  // thread. That matters because the token has no expiry: an older link in that
  // thread still works and still names the OLDER submission, so a candidate who
  // applied twice can reopen and edit the application nobody is reading.
  //
  // NOT THE DATE. The first version of this used the submission's date, which
  // collides for the single most likely case there is -- the code above calls a
  // second submission "a correction", and a correction is sent the same day. It
  // is a per-submission REFERENCE instead, so it is exactly stable across
  // re-sends of one application (they are the same link, and belong in one
  // conversation) and distinct for a second application however close together
  // the two were sent.
  //
  // Keyed rather than a bare hash of the id: submission_id is a small sequential
  // integer, so an unkeyed digest of it is trivially reversible and would put a
  // running count of how many people have applied into a mail subject line.
  const application_reference = createHmac('sha256', config.jwt.secret)
    .update(`waitlist-application-${submission.submission_id}`)
    .digest('hex')
    .slice(0, 6)

  const { is_sent } = await sendEmail({
    to: submission.contact_email,
    subject: `Your application to the league (${application_reference})`,
    message: `Thanks for applying. If you want to change any of your answers before the managers vote, this link opens your application:\n\n${edit_link}\n\nThis link opens application ${application_reference}. If you have applied more than once, each application has its own link and its own reference, and the managers read the most recent one.\n\nKeep it to yourself -- anyone holding it can edit what you submitted. If you did not apply, ignore this.`
  })

  return Boolean(is_sent)
}

// Validates a body against the questionnaire and returns the row to write, or
// the refusal to send. ONE implementation for the submit and the edit paths:
// they accept the same fields under the same rules, and two copies of this is
// how an edit path quietly ends up storing what a submit path would refuse.
const read_submission_from_body = (body) => {
  const submission = {
    questionnaire_version: manager_waitlist_questionnaire_version
  }

  for (const field of contact_fields) {
    const value = read_answer(body, field.column)

    if (!value) {
      if (field.required) {
        return { error: `Missing ${field.column}` }
      }
      submission[field.column] = null
      continue
    }

    if (value.length > field.max) {
      return { error: `${field.column} is too long` }
    }

    submission[field.column] = value
  }

  if (!EMAIL_RE.test(submission.contact_email)) {
    return { error: 'Invalid contact_email' }
  }

  // Validated in whatever case the candidate typed, stored in one. Done after
  // the pattern check so the refusal above still reads against his own input.
  submission.contact_email = normalize_email(submission.contact_email)

  // Strict `!== true` rather than a truthy check: the affirmation is the one
  // field where a caller sending the string 'false' must not be read as yes.
  if (body.has_affirmed_commitment !== true) {
    return { error: `You must confirm: ${commitment_affirmation_label}` }
  }
  submission.has_affirmed_commitment = true

  const responses = {}
  for (const question of questions) {
    const value = read_answer(body, question.id)

    if (!value) {
      if (question.required) {
        return { error: `Missing ${question.id}` }
      }
      continue
    }

    // A question with `options` is a closed vocabulary, so the value has to be
    // one of them. Without this the select is only a client-side suggestion --
    // anyone posting by hand could put arbitrary prose into a field the
    // managers' page presents as a comparable range, which is the one thing
    // these two questions exist to avoid.
    if (question.options) {
      if (!question.options.includes(value)) {
        return { error: `${question.id} is not one of the choices` }
      }
      responses[question.id] = value
      continue
    }

    if (value.length > question.max) {
      return { error: `${question.id} is too long` }
    }

    responses[question.id] = value
  }

  // Only keys the current question set defines are stored. An unrecognised key
  // in the body is dropped rather than written through, so a stale client -- or
  // anyone posting by hand -- cannot put arbitrary content into a schemaless
  // column that the managers' page then renders.
  submission.responses = JSON.stringify(responses)

  return { submission }
}

// Whether this submission is named as a Candidate on an Admission Vote. Once it
// is, the Managers are ranking the answers ON THE CARD, so the candidate can no
// longer change them under them -- editing after a ballot has been cast would
// make the vote a judgement on text nobody voted on. Before that the row is
// just an application and is his to correct.
const is_named_on_an_admission_vote = async ({ db, submission_id }) => {
  const candidate = await db('admission_vote_candidates')
    .where({ submission_id })
    .first()

  return Boolean(candidate)
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
 *
 *       On success the candidate is emailed a link carrying an edit token for
 *       the row, which is the only way back to it. The token is never returned
 *       in this response.
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
 *                 is_edit_link_sent:
 *                   type: boolean
 *                   description: Whether the mail provider accepted the edit link. False means the answers are stored but no link went out, and the page says so rather than promising mail. It is never a claim about delivery, which is decided after the response.
 *       400:
 *         description: A required answer is missing, an answer is too long, or the commitment was not affirmed
 *       429:
 *         description: Too many submissions from this address
 */
router.post('/', submit_rate_limiter, async (req, res) => {
  const { db, config, logger } = req.app.locals
  try {
    // Answered honeypot: accept it as far as the caller can see. Telling a bot
    // which field gave it away is free information for the next attempt.
    //
    // IT MUST MATCH THE SUCCESS SHAPE EXACTLY, `is_edit_link_sent` included.
    // Returning a bare `{ success: true }` made this response DISTINGUISHABLE
    // from a real one, which defeats the stated intent twice over: a bot can
    // read the missing key as "you were caught", and the page -- which branches
    // on that key -- rendered the not-sent copy, whose whole point is to
    // reassure the reader that "your application is saved". Nothing was saved
    // here, so that was the one claim the server must not make. The field is
    // off-screen rather than `display: none` so that bots fill it, and password
    // managers fill off-screen fields too, so a real candidate reaching this
    // branch is unlikely but not impossible.
    if (req.body[honeypot_field_name]) {
      return res.send({ success: true, is_edit_link_sent: true })
    }

    const { submission, error } = read_submission_from_body(req.body)

    if (error) {
      return res.status(400).send({ error })
    }

    const [row] = await db('manager_waitlist_submissions')
      .insert(submission)
      .returning('submission_id')

    // The edit link goes out by MAIL rather than in this response, which is the
    // whole identity mechanism: the form is anonymous, so the only thing that
    // distinguishes the candidate from anyone else who can post to this route
    // is that he holds the address he gave. Handing the token back here would
    // let anyone who submits a form under someone else's address hold a
    // credential for the row they created.
    let is_edit_link_sent = false
    try {
      is_edit_link_sent = await send_edit_link({
        config,
        submission: {
          submission_id: row.submission_id,
          contact_email: submission.contact_email
        }
      })
    } catch (email_error) {
      logger(email_error)
    }

    // WHETHER THE LINK WENT OUT IS REPORTED, because the page says so to the
    // candidate. Swallowing the failure and printing "we have emailed you a
    // link" regardless is a promise the server knows to be false, and it costs
    // the candidate the only route back to his answers while he waits for mail
    // that is not coming. The answers are stored either way, so this is a note
    // on the acknowledgement rather than a failure of the submission.
    //
    // Still no id and no token here: the link is delivered by mail alone.
    res.send({ success: true, is_edit_link_sent })
  } catch (error) {
    logger(error)
    // 500, not 400. Nothing reaches this catch that the caller could have
    // caused -- every caller-caused refusal above returns before it -- and a
    // route whose catch-all maps its own failures to 4xx has no observable for
    // its own breakage.
    res.status(500).send({ error: error.message })
  }
})

/**
 * @swagger
 * /waitlist/edit-link:
 *   post:
 *     summary: Email a candidate the link back to his own application
 *     description: |
 *       Public and unauthenticated, and deliberately not an oracle: the answer
 *       is the same whether or not an application exists for the address, so
 *       this route cannot be used to ask who has applied. When one does exist,
 *       a link carrying an edit token is emailed to it. Rate limited per IP.
 *     tags:
 *       - Waitlist
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - contact_email
 *             properties:
 *               contact_email:
 *                 type: string
 *     responses:
 *       200:
 *         description: The request was accepted. An unknown address is NOT distinguishable here.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *       400:
 *         description: No contact_email was given
 *       429:
 *         description: Too many link requests from this address
 */
router.post('/edit-link', edit_link_rate_limiter, async (req, res) => {
  const { db, config, logger } = req.app.locals
  try {
    const contact_email = normalize_email(
      read_answer(req.body, 'contact_email')
    )

    if (!contact_email) {
      return res.status(400).send({ error: 'Missing contact_email' })
    }

    // The NEWEST application for the address. Nothing stops a candidate
    // submitting twice, and the one he means is the one he sent last -- the
    // earlier rows stay reachable only through their own emailed links.
    const submission = await db('manager_waitlist_submissions')
      .where({ contact_email })
      .orderBy('submission_id', 'desc')
      .first()

    if (submission) {
      try {
        await send_edit_link({ config, submission })
      } catch (email_error) {
        logger(email_error)
      }
    }

    // Answered identically either way, and BEFORE anything about the row
    // reaches the response. The address is somebody's application to a private
    // league; whether one exists is exactly the fact this route must not leak.
    //
    // DELIBERATELY NOT `is_edit_link_sent`, unlike the submit route above.
    // Reporting whether mail went out here reports whether a row was found,
    // which is the enumeration oracle this route is shaped to avoid -- the
    // submit route can say it because the caller supplied the row himself.
    res.send({ success: true })
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.message })
  }
})

/**
 * @swagger
 * /waitlist/submission:
 *   get:
 *     summary: Read the application an edit token names
 *     description: |
 *       Public and unauthenticated, and reachable ONLY with an edit token from
 *       the link emailed to the candidate. The token names one row, so there is
 *       no caller-supplied identifier and no ownership predicate; without a
 *       token the handler returns before it queries.
 *
 *       Returns the candidate's own answers so the form can be rendered filled
 *       in, plus whether the application is locked because it is already named
 *       on an admission vote.
 *     tags:
 *       - Waitlist
 *     parameters:
 *       - in: query
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: The application the token names
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WaitlistSubmissionForCandidate'
 *       401:
 *         description: The token is missing, malformed, or not an edit token
 *       404:
 *         description: The token is valid and names no application
 */
router.get('/submission', async (req, res) => {
  const { db, config, logger } = req.app.locals
  try {
    const submission_id = read_edit_token({ config, token: req.query.token })

    if (!submission_id) {
      return res.status(401).send({ error: 'Invalid link' })
    }

    const submission = await db('manager_waitlist_submissions')
      .where({ submission_id })
      .first()

    // A valid token naming no row means the round closed and the table was
    // emptied, which is the only revocation this token has.
    if (!submission) {
      return res
        .status(404)
        .send({ error: 'That application is no longer open' })
    }

    const is_locked = await is_named_on_an_admission_vote({ db, submission_id })

    // Built by hand rather than sent wholesale, so a column added to the table
    // later reaches the managers' page without also reaching an anonymous
    // caller holding a link.
    res.send({
      submission_id: submission.submission_id,
      questionnaire_version: submission.questionnaire_version,
      submitted_at: submission.submitted_at,
      candidate_name: submission.candidate_name,
      contact_email: submission.contact_email,
      contact_handle: submission.contact_handle,
      timezone_name: submission.timezone_name,
      has_affirmed_commitment: submission.has_affirmed_commitment,
      responses: submission.responses,
      is_locked
    })
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.message })
  }
})

/**
 * @swagger
 * /waitlist:
 *   put:
 *     summary: Replace the application an edit token names
 *     description: |
 *       Public and unauthenticated, and reachable ONLY with an edit token from
 *       the link emailed to the candidate. The body is validated exactly as a
 *       new submission is, and REPLACES the stored answers wholesale -- an
 *       answer omitted from the body is cleared, so the form sends every field
 *       it rendered. The stored questionnaire version becomes the current one,
 *       since the answers are the ones the current question set asked for.
 *
 *       Refused once the application is named as a candidate on an admission
 *       vote: from that point the managers are ranking the answers as they
 *       stand.
 *     tags:
 *       - Waitlist
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *               - candidate_name
 *               - contact_email
 *               - timezone_name
 *               - has_affirmed_commitment
 *             properties:
 *               token:
 *                 type: string
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
 *     responses:
 *       200:
 *         description: The application was replaced
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *       400:
 *         description: A required answer is missing, an answer is too long, or the commitment was not affirmed
 *       401:
 *         description: The token is missing, malformed, or not an edit token
 *       404:
 *         description: The token is valid and names no application
 *       409:
 *         description: The application is named on an admission vote and can no longer be edited
 *       429:
 *         description: Too many edits from this address
 */
router.put('/', edit_rate_limiter, async (req, res) => {
  const { db, config, logger } = req.app.locals
  try {
    const submission_id = read_edit_token({ config, token: req.body.token })

    if (!submission_id) {
      return res.status(401).send({ error: 'Invalid link' })
    }

    const existing = await db('manager_waitlist_submissions')
      .where({ submission_id })
      .first()

    if (!existing) {
      return res
        .status(404)
        .send({ error: 'That application is no longer open' })
    }

    if (await is_named_on_an_admission_vote({ db, submission_id })) {
      return res.status(409).send({
        error:
          'The managers are already voting on this application, so it can no longer be changed. Email the commissioner.'
      })
    }

    const { submission, error } = read_submission_from_body(req.body)

    if (error) {
      return res.status(400).send({ error })
    }

    // STAMPED HERE RATHER THAN DEFAULTED ON THE COLUMN, so it marks the act of
    // editing rather than the row being touched. The managers' card shows it,
    // because the vote lock protects the BALLOT and this protects the reading
    // that happens before one opens: a manager who read these answers on Tuesday
    // has no other way to learn they were rewritten on Wednesday.
    await db('manager_waitlist_submissions')
      .where({ submission_id })
      .update({ ...submission, edited_at: new Date() })

    res.send({ success: true })
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.message })
  }
})

export default router
