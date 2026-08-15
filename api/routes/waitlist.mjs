import express from 'express'
import rate_limit, { MemoryStore } from 'express-rate-limit'

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

// Longest answer here is the prior-league-history paragraph. Generous enough
// that nobody writing in good faith is truncated, bounded so a single request
// cannot push megabytes of text into a table nothing paginates.
const MAX_SHORT_ANSWER_LENGTH = 200
const MAX_LONG_ANSWER_LENGTH = 4000

// Every question, in the order the form asks them. `required` is what the route
// enforces; the column set in
// db/adhoc/2026-08-15-add-manager-waitlist-submissions.sql matches it exactly.
const FIELDS = [
  { name: 'candidate_name', required: true, max: MAX_SHORT_ANSWER_LENGTH },
  { name: 'contact_email', required: true, max: MAX_SHORT_ANSWER_LENGTH },
  { name: 'contact_handle', required: false, max: MAX_SHORT_ANSWER_LENGTH },
  { name: 'timezone_name', required: true, max: MAX_SHORT_ANSWER_LENGTH },
  { name: 'commitment_intent', required: true, max: MAX_LONG_ANSWER_LENGTH },
  { name: 'dynasty_experience', required: true, max: MAX_LONG_ANSWER_LENGTH },
  {
    name: 'salary_cap_experience',
    required: true,
    max: MAX_LONG_ANSWER_LENGTH
  },
  {
    name: 'contract_mechanics_comfort',
    required: true,
    max: MAX_LONG_ANSWER_LENGTH
  },
  { name: 'offseason_activity', required: true, max: MAX_LONG_ANSWER_LENGTH },
  { name: 'rules_tolerance', required: true, max: MAX_LONG_ANSWER_LENGTH },
  {
    name: 'commissioner_disagreement',
    required: true,
    max: MAX_LONG_ANSWER_LENGTH
  },
  { name: 'prior_league_history', required: true, max: MAX_LONG_ANSWER_LENGTH },
  { name: 'requested_seat', required: false, max: MAX_SHORT_ANSWER_LENGTH }
]

// Deliberately loose. The email is a contact route the Commissioner will reply
// to by hand, not a login, so the only failure worth refusing is one that
// cannot be a mailbox at all -- and a strict pattern here rejects real
// addresses, which on a form whose scarce resource is COMPLETION costs more
// than it saves.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// A hidden field no human ever fills. A form-filling bot populates every input
// it finds, so a non-empty value is a bot with no false-positive path -- unlike
// a timing floor or a content heuristic, both of which refuse real people.
const HONEYPOT_FIELD = 'league_website'

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

/**
 * @swagger
 * /waitlist:
 *   post:
 *     summary: Submit a manager vetting questionnaire response
 *     description: |
 *       Public and unauthenticated. Accepts one prospective manager's answers
 *       to the vetting questionnaire, which feed the league's waiting-list
 *       ranking vote. Rate limited per IP.
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
 *               - commitment_intent
 *               - dynasty_experience
 *               - salary_cap_experience
 *               - contract_mechanics_comfort
 *               - offseason_activity
 *               - rules_tolerance
 *               - commissioner_disagreement
 *               - prior_league_history
 *             properties:
 *               candidate_name:
 *                 type: string
 *               contact_email:
 *                 type: string
 *               contact_handle:
 *                 type: string
 *               timezone_name:
 *                 type: string
 *               commitment_intent:
 *                 type: string
 *               dynasty_experience:
 *                 type: string
 *               salary_cap_experience:
 *                 type: string
 *               contract_mechanics_comfort:
 *                 type: string
 *               offseason_activity:
 *                 type: string
 *               rules_tolerance:
 *                 type: string
 *               commissioner_disagreement:
 *                 type: string
 *               prior_league_history:
 *                 type: string
 *               requested_seat:
 *                 type: string
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
 *         description: A required answer is missing or an answer is too long
 *       429:
 *         description: Too many submissions from this address
 */
router.post('/', submit_rate_limiter, async (req, res) => {
  const { logger } = req.app.locals
  try {
    // Answered honeypot: accept it as far as the caller can see. Telling a bot
    // which field gave it away is free information for the next attempt, and
    // there is no human on the other end to mislead.
    if (req.body[HONEYPOT_FIELD]) {
      return res.send({ success: true })
    }

    const submission = {}

    for (const field of FIELDS) {
      const raw = req.body[field.name]
      const value = typeof raw === 'string' ? raw.trim() : ''

      if (!value) {
        if (field.required) {
          return res.status(400).send({ error: `Missing ${field.name}` })
        }
        // An absent optional answer is stored as NULL rather than as an empty
        // string, so the reading surface can tell "left blank" from "answered
        // with nothing" without a second convention.
        submission[field.name] = null
        continue
      }

      if (value.length > field.max) {
        return res.status(400).send({ error: `${field.name} is too long` })
      }

      submission[field.name] = value
    }

    if (!EMAIL_RE.test(submission.contact_email)) {
      return res.status(400).send({ error: 'Invalid contact_email' })
    }

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
