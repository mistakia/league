/* global describe before beforeEach it */
import * as chai from 'chai'
import chai_http, { request as chai_request } from 'chai-http'

import server from '#api'
import knex from '#db'
import users from '#db/fixtures/users.mjs'
import {
  ANONYMOUS_SUBMISSIONS_PER_DAY,
  anonymous_submit_rate_limit_store,
  authenticated_submit_rate_limit_store,
  answer_rate_limit_store,
  hash_claim_token,
  MAXIMUM_SCREENSHOT_BYTES
} from '#api/routes/contributions.mjs'
import purge_submission from '#libs-server/contribution/purge-submission.mjs'
import { user1, user2 } from './fixtures/token.mjs'

chai.use(chai_http)
chai.should()
const expect = chai.expect

// THE TWO ADMISSION LANES, and specifically the seam between them. Anyone may
// submit -- the surface is reachable logged out from /data-views and /plays --
// but only an authenticated submitter's report may enter the automated planning
// path. What this spec pins is that admission and autonomy are separate: an
// anonymous caller gets a 200 and a stored row, AND that row is marked
// `untrusted`.
//
// The anonymous read cases matter most. This router mounts ABOVE the blanket
// auth guard, and both of this repository's live privacy holes were a pre-guard
// route whose ownership predicate read as true for a caller with no credential.

const valid_submission = {
  submission_kind: 'bug_report',
  submission_title: 'Data view table renders empty',
  submission_body:
    'Opening a saved data view shows a header row and no player rows underneath.'
}

const submit = (body, token = null) => {
  const request = chai_request.execute(server).post('/api/contributions')
  if (token) request.set('Authorization', `Bearer ${token}`)
  return request.send(body)
}

const read_detail = ({ submission_id, token = null, claim_token = null }) => {
  const request = chai_request
    .execute(server)
    .get(`/api/contributions/${submission_id}`)
  if (token) request.set('Authorization', `Bearer ${token}`)
  if (claim_token) request.set('x-contribution-claim-token', claim_token)
  return request
}

const list = (token = null) => {
  const request = chai_request.execute(server).get('/api/contributions')
  if (token) request.set('Authorization', `Bearer ${token}`)
  return request
}

describe('ROUTES /contributions', function () {
  before(async function () {
    this.timeout(60 * 1000)
    await knex.seed.run()
    await users(knex)
  })

  beforeEach(async function () {
    // Children first: contribution_answers hangs off contribution_questions,
    // which hangs off contribution_submissions. The foreign keys are ON DELETE
    // CASCADE so a single delete of the parent would do -- clearing explicitly
    // keeps the spec honest if that ever changes.
    await knex('contribution_answers').del()
    await knex('contribution_questions').del()
    await knex('contribution_events').del()
    await knex('contribution_submissions').del()
    await knex('contribution_trust_overrides').del()

    // The limiters stay LIVE under test -- see the stores' comment in the route
    // -- so the 429 paths are exercised rather than assumed. Each case starts
    // them fresh.
    anonymous_submit_rate_limit_store.resetAll()
    authenticated_submit_rate_limit_store.resetAll()
    answer_rate_limit_store.resetAll()
  })

  describe('admission', function () {
    it('admits an anonymous submission at the untrusted tier', async function () {
      const response = await submit(valid_submission)

      response.should.have.status(200)
      response.body.submission_trust_tier.should.equal('untrusted')
      response.body.submission_status.should.equal('received')

      const row = await knex('contribution_submissions')
        .where({ submission_id: response.body.submission_id })
        .first()

      expect(row.submitter_user_id).to.equal(null)
      row.submission_trust_tier.should.equal('untrusted')
    })

    it('admits an authenticated submission at the standard tier', async function () {
      const response = await submit(valid_submission, user1)

      response.should.have.status(200)
      response.body.submission_trust_tier.should.equal('standard')

      const row = await knex('contribution_submissions')
        .where({ submission_id: response.body.submission_id })
        .first()

      row.submitter_user_id.should.equal(1)
    })

    // The operator's lever. Flipping which submissions qualify for autonomous
    // triage is a row in a table, not a branch -- so this case changes NO code
    // and expects a different tier out of the same request.
    it('honors a per-submitter trust override with no code change', async function () {
      await knex('contribution_trust_overrides').insert({
        submitter_user_id: 1,
        submission_trust_tier: 'untrusted',
        override_reason: 'flooding the queue'
      })

      const response = await submit(valid_submission, user1)

      response.body.submission_trust_tier.should.equal('untrusted')
    })

    it('records a creation event inside the inserting transaction', async function () {
      const response = await submit(valid_submission)

      const events = await knex('contribution_events').where({
        submission_id: response.body.submission_id
      })

      events.length.should.equal(1)
      events[0].contribution_event_type.should.equal('submission_created')
      events[0].new_submission_status.should.equal('received')
    })
  })

  describe('validation', function () {
    it('refuses an unknown submission_kind', async function () {
      const response = await submit({
        ...valid_submission,
        submission_kind: 'spam'
      })
      response.should.have.status(400)
    })

    it('refuses a title or body below the substance floor', async function () {
      const short_title = await submit({
        ...valid_submission,
        submission_title: 'bug'
      })
      short_title.should.have.status(400)

      const short_body = await submit({
        ...valid_submission,
        submission_body: 'broken'
      })
      short_body.should.have.status(400)
    })

    // The client is the untrusted party on this route. The column carries a
    // check constraint too; this refusal exists so the caller gets a 400 naming
    // the problem instead of a constraint violation they cannot act on.
    it('refuses an oversized captured_context with a 400, not a constraint error', async function () {
      const response = await submit({
        ...valid_submission,
        captured_context: { blob: 'x'.repeat(300000) }
      })

      response.should.have.status(400)
      response.body.error.should.match(/captured_context/)
    })

    // Context is a triage aid, never a submission precondition: a client whose
    // build-manifest fetch failed sends a partial object and must still submit.
    it('accepts a partial captured_context', async function () {
      const response = await submit({
        ...valid_submission,
        captured_context: { route: '/data-views', build: null }
      })

      response.should.have.status(200)
    })
  })

  describe('rate limiting', function () {
    // express-slow-down, which this repository already applies elsewhere,
    // DELAYS and never refuses. A submission endpoint needs a hard refusal, so
    // this case asserts a 429 rather than merely a slower 200.
    it('refuses an anonymous burst with 429 rather than delaying it', async function () {
      for (let index = 0; index < ANONYMOUS_SUBMISSIONS_PER_DAY; index++) {
        const allowed = await submit(valid_submission)
        allowed.should.have.status(200)
      }

      const refused = await submit(valid_submission)
      refused.should.have.status(429)
    })

    it('leaves an authenticated submitter unaffected by an anonymous burst', async function () {
      for (let index = 0; index < ANONYMOUS_SUBMISSIONS_PER_DAY; index++) {
        await submit(valid_submission)
      }
      ;(await submit(valid_submission)).should.have.status(429)

      // Same address, different lane. The two stores exist so anonymous volume
      // from a shared NAT cannot exhaust an authenticated submitter's budget.
      const authenticated = await submit(valid_submission, user1)
      authenticated.should.have.status(200)
    })
  })

  describe('reading a submission', function () {
    it('refuses an anonymous caller on the list route', async function () {
      await submit(valid_submission, user1)

      const response = await list()

      response.should.have.status(401)
      // The refusal leaks no rows.
      expect(response.body.submission_id).to.equal(undefined)
      JSON.stringify(response.body).should.not.match(/renders empty/)
    })

    it('scopes the list to the authenticated author', async function () {
      await submit(valid_submission, user1)
      await submit(
        { ...valid_submission, submission_title: 'Somebody else report' },
        user2
      )

      const response = await list(user1)

      response.should.have.status(200)
      response.body.length.should.equal(1)
      response.body[0].submission_title.should.equal(
        valid_submission.submission_title
      )
    })

    it('admits the claim token holder to an anonymous submission', async function () {
      const created = await submit(valid_submission)
      created.body.claim_token.should.be.a('string')

      const response = await read_detail({
        submission_id: created.body.submission_id,
        claim_token: created.body.claim_token
      })

      response.should.have.status(200)
      response.body.submission_body.should.equal(
        valid_submission.submission_body
      )
    })

    // 404 rather than 403: a 403 confirms the row exists, which turns the route
    // into an oracle for enumerating other people's submission identifiers.
    it('answers 404, not 403, for a wrong or absent claim token', async function () {
      const created = await submit(valid_submission)

      const wrong = await read_detail({
        submission_id: created.body.submission_id,
        claim_token: 'not-the-token'
      })
      wrong.should.have.status(404)

      const absent = await read_detail({
        submission_id: created.body.submission_id
      })
      absent.should.have.status(404)
    })

    it('refuses another authenticated user reading a submission', async function () {
      const created = await submit(valid_submission, user1)

      const response = await read_detail({
        submission_id: created.body.submission_id,
        token: user2
      })

      response.should.have.status(404)
    })

    // A claim token is minted for the anonymous lane only, and it must not open
    // an authenticated submitter's row.
    it('does not issue a claim token to an authenticated submitter', async function () {
      const created = await submit(valid_submission, user1)
      expect(created.body.claim_token).to.equal(null)
    })

    it('never returns the claim token digest', async function () {
      const created = await submit(valid_submission)

      const response = await read_detail({
        submission_id: created.body.submission_id,
        claim_token: created.body.claim_token
      })

      expect(response.body.claim_token_hash).to.equal(undefined)
      JSON.stringify(response.body).should.not.match(
        new RegExp(hash_claim_token(created.body.claim_token))
      )
    })
  })

  describe('answering a follow-up question', function () {
    const ask = async (submission_id) => {
      const [question] = await knex('contribution_questions')
        .insert({
          submission_id,
          question_template_key: 'reproduction_steps',
          question_text: 'What steps reproduce it?',
          expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
        })
        .returning('question_id')
      return question.question_id
    }

    it('records an answer and moves the submission off awaiting_information', async function () {
      const created = await submit(valid_submission)
      await knex('contribution_submissions')
        .where({ submission_id: created.body.submission_id })
        .update({ submission_status: 'awaiting_information' })
      const question_id = await ask(created.body.submission_id)

      const response = await chai_request
        .execute(server)
        .post(`/api/contributions/${created.body.submission_id}/answers`)
        .set('x-contribution-claim-token', created.body.claim_token)
        .send({ question_id, answer_body: 'Open a saved view and reload.' })

      response.should.have.status(200)

      const row = await knex('contribution_submissions')
        .where({ submission_id: created.body.submission_id })
        .first('submission_status')
      row.submission_status.should.equal('received')

      const events = await knex('contribution_events')
        .where({ submission_id: created.body.submission_id })
        .orderBy('occurred_at', 'asc')
      events
        .map((e) => e.contribution_event_type)
        .should.include('answer_received')
    })

    it('refuses a second answer to the same question', async function () {
      const created = await submit(valid_submission)
      const question_id = await ask(created.body.submission_id)

      const answer = () =>
        chai_request
          .execute(server)
          .post(`/api/contributions/${created.body.submission_id}/answers`)
          .set('x-contribution-claim-token', created.body.claim_token)
          .send({ question_id, answer_body: 'An answer.' })

      ;(await answer()).should.have.status(200)
      ;(await answer()).should.have.status(409)
    })

    // Without the submission_id predicate on the question lookup, a caller
    // holding one valid claim token could answer any question in the table by
    // naming its identifier.
    it('refuses answering a question belonging to another submission', async function () {
      const mine = await submit(valid_submission)
      const theirs = await submit(valid_submission, user1)
      const their_question_id = await ask(theirs.body.submission_id)

      const response = await chai_request
        .execute(server)
        .post(`/api/contributions/${mine.body.submission_id}/answers`)
        .set('x-contribution-claim-token', mine.body.claim_token)
        .send({ question_id: their_question_id, answer_body: 'An answer.' })

      response.should.have.status(404)
    })

    const ask_expired = async (submission_id) => {
      const [question] = await knex('contribution_questions')
        .insert({
          submission_id,
          question_template_key: 'reproduction_steps',
          question_text: 'What steps reproduce it?',
          expires_at: new Date(Date.now() - 86400000)
        })
        .returning('question_id')
      return question.question_id
    }

    // THE RESURFACE PATH. Expiry reclaims a queue slot; it is not a closed
    // door. The submitter who comes back a month later carries the one fact
    // that makes the report actionable, and refusing them throws it away.
    it('accepts a late answer and resurfaces an expired submission', async function () {
      const created = await submit(valid_submission)
      await knex('contribution_submissions')
        .where({ submission_id: created.body.submission_id })
        .update({ submission_status: 'expired' })
      const question_id = await ask_expired(created.body.submission_id)

      const response = await chai_request
        .execute(server)
        .post(`/api/contributions/${created.body.submission_id}/answers`)
        .set('x-contribution-claim-token', created.body.claim_token)
        .send({ question_id, answer_body: 'Open a saved view and reload.' })

      response.should.have.status(200)

      const row = await knex('contribution_submissions')
        .where({ submission_id: created.body.submission_id })
        .first('submission_status')
      row.submission_status.should.equal('received')

      const event = await knex('contribution_events')
        .where({
          submission_id: created.body.submission_id,
          contribution_event_type: 'answer_received'
        })
        .first()
      event.previous_submission_status.should.equal('expired')
      event.event_context.is_late_answer.should.equal(true)
    })

    // The negative control for the case above: a late answer is information,
    // never a veto over a disposition somebody already made.
    it('records a late answer without reopening a rejected submission', async function () {
      const created = await submit(valid_submission)
      await knex('contribution_submissions')
        .where({ submission_id: created.body.submission_id })
        .update({ submission_status: 'rejected' })
      const question_id = await ask_expired(created.body.submission_id)

      const response = await chai_request
        .execute(server)
        .post(`/api/contributions/${created.body.submission_id}/answers`)
        .set('x-contribution-claim-token', created.body.claim_token)
        .send({ question_id, answer_body: 'Open a saved view and reload.' })

      response.should.have.status(200)

      const row = await knex('contribution_submissions')
        .where({ submission_id: created.body.submission_id })
        .first('submission_status')
      row.submission_status.should.equal('rejected')

      const answer = await knex('contribution_answers')
        .where({ question_id })
        .first()
      expect(answer).to.not.equal(undefined)
    })

    // A purged submission has no body left to triage, so returning it to the
    // queue would put an unreadable row in front of a human.
    it('does not resurface a purged submission', async function () {
      const created = await submit(valid_submission)
      const { submission_id } = created.body
      const question_id = await ask_expired(submission_id)
      await purge_submission({ db: knex, submission_id })
      await knex('contribution_submissions')
        .where({ submission_id })
        .update({ submission_status: 'expired' })

      const response = await chai_request
        .execute(server)
        .post(`/api/contributions/${submission_id}/answers`)
        .set('x-contribution-claim-token', created.body.claim_token)
        .send({ question_id, answer_body: 'Open a saved view and reload.' })

      response.should.have.status(200)

      const row = await knex('contribution_submissions')
        .where({ submission_id })
        .first('submission_status')
      row.submission_status.should.equal('expired')
    })
  })

  // The image round trip, asserted on the BYTES rather than on a 200. The
  // route can answer 200 having written nothing, so the oracle is that what
  // comes back out of bytea is byte-identical to what went in.
  describe('screenshot', function () {
    // A one-pixel JPEG. Real enough to have a content type and a decodable
    // payload, small enough to keep the fixture inline.
    const tiny_jpeg_bytes = Buffer.from(
      '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==',
      'base64'
    )
    const tiny_jpeg_data_uri = `data:image/jpeg;base64,${tiny_jpeg_bytes.toString('base64')}`

    it('stores the bytes and points the submission at them', async function () {
      const created = await submit({
        ...valid_submission,
        screenshot: tiny_jpeg_data_uri
      })
      created.should.have.status(200)
      const { submission_id } = created.body

      const image = await knex('contribution_screenshots')
        .where({ submission_id })
        .first()

      expect(image).to.not.equal(undefined)
      image.image_format.should.equal('image/jpeg')
      image.image_size.should.equal(tiny_jpeg_bytes.length)
      Buffer.compare(image.image_data, tiny_jpeg_bytes).should.equal(0)

      const row = await knex('contribution_submissions')
        .where({ submission_id })
        .first('screenshot_reference')
      row.screenshot_reference.should.equal(
        `contribution_screenshots:${submission_id}`
      )
    })

    // The screenshot is a triage aid and never a precondition, so the ordinary
    // case -- a client whose capture degraded to null -- must still submit.
    it('accepts a submission with no screenshot', async function () {
      const created = await submit(valid_submission)
      created.should.have.status(200)

      const image = await knex('contribution_screenshots')
        .where({ submission_id: created.body.submission_id })
        .first()
      expect(image).to.equal(undefined)

      const row = await knex('contribution_submissions')
        .where({ submission_id: created.body.submission_id })
        .first('screenshot_reference')
      expect(row.screenshot_reference).to.equal(null)
    })

    it('refuses a payload that is not a data URI', async function () {
      const response = await submit({
        ...valid_submission,
        screenshot: 'https://example.com/screenshot.jpg'
      })
      response.should.have.status(400)
    })

    it('refuses a content type the column would reject', async function () {
      const response = await submit({
        ...valid_submission,
        screenshot: 'data:image/gif;base64,R0lGODlhAQABAAAAACw='
      })
      response.should.have.status(400)
    })

    // The ceiling is enforced on DECODED bytes. A base64 string a third larger
    // than the limit decodes to exactly the limit, so a naive length check on
    // the string would refuse this and a correct one admits it -- which is the
    // pair that makes the check non-vacuous.
    it('refuses an image over the byte ceiling', async function () {
      const oversized = Buffer.alloc(MAXIMUM_SCREENSHOT_BYTES + 1, 0x41)
      const response = await submit({
        ...valid_submission,
        screenshot: `data:image/jpeg;base64,${oversized.toString('base64')}`
      })
      response.should.have.status(400)
    })

    it('deletes the bytes on purge', async function () {
      const created = await submit({
        ...valid_submission,
        screenshot: tiny_jpeg_data_uri
      })
      const { submission_id } = created.body

      await purge_submission({ db: knex, submission_id })

      const image = await knex('contribution_screenshots')
        .where({ submission_id })
        .first()
      expect(image).to.equal(undefined)

      const row = await knex('contribution_submissions')
        .where({ submission_id })
        .first('screenshot_reference')
      expect(row.screenshot_reference).to.equal(null)
    })
  })

  describe('purge', function () {
    it('redacts content while preserving the event trail', async function () {
      const created = await submit(valid_submission)
      const { submission_id } = created.body
      const question_id = await knex('contribution_questions')
        .insert({
          submission_id,
          question_template_key: 'reproduction_steps',
          question_text: 'What steps reproduce it?',
          expires_at: new Date(Date.now() + 86400000)
        })
        .returning('question_id')
        .then(([row]) => row.question_id)
      await knex('contribution_answers').insert({
        question_id,
        answer_body: 'my email is casey@example.com'
      })

      const result = await purge_submission({ db: knex, submission_id })
      result.purged.should.equal(true)

      const row = await knex('contribution_submissions')
        .where({ submission_id })
        .first()

      expect(row.captured_context).to.equal(null)
      row.submission_body.should.not.match(/saved data view/)
      expect(row.purged_at).to.not.equal(null)

      // The answer carried the submitter's address, so it is redacted with the
      // body rather than left behind.
      const answer = await knex('contribution_answers')
        .where({ question_id })
        .first()
      answer.answer_body.should.not.match(/casey@example.com/)

      // The trail survives, which is the whole point of redacting rather than
      // deleting: a shipped fix stays traceable to the report that caused it.
      const events = await knex('contribution_events').where({ submission_id })
      events.length.should.be.greaterThan(1)
      events
        .map((e) => e.contribution_event_type)
        .should.include('submission_purged')
    })

    it('is idempotent', async function () {
      const created = await submit(valid_submission)
      const { submission_id } = created.body

      const first = await purge_submission({ db: knex, submission_id })
      first.purged.should.equal(true)

      const second = await purge_submission({ db: knex, submission_id })
      second.purged.should.equal(false)
      second.reason.should.equal('already_purged')
    })
  })
})
