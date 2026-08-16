/* global describe before beforeEach it after */
import * as chai from 'chai'
import chai_http, { request as chai_request } from 'chai-http'
import MockDate from 'mockdate'

import jwt from 'jsonwebtoken'

import server from '#api'
import knex from '#db'
import config from '#config'
import league from '#db/fixtures/league.mjs'
import users from '#db/fixtures/users.mjs'
import { current_season } from '#constants'
import {
  EDIT_LINK_REQUESTS_PER_DAY,
  SUBMISSIONS_PER_DAY,
  edit_link_rate_limit_store,
  edit_rate_limit_store,
  submit_rate_limit_store
} from '#api/routes/waitlist.mjs'
import {
  manager_waitlist_questionnaire_version,
  questions
} from '#libs-shared/manager-waitlist-questions.mjs'
import { user1 } from './fixtures/token.mjs'

chai.use(chai_http)
chai.should()
const expect = chai.expect
const { regular_season_start } = current_season

const league_id = 1

// The vetting questionnaire's two routes, and specifically the seam between
// them: the submit route is public by necessity and the read route carries
// candidate PII, so what this spec is really pinning is that the two cannot be
// confused for one another. Both of this repo's live privacy holes were a
// pre-guard route reading user-owned rows, so the anonymous GET case below is
// the assertion that matters most.

// Built FROM the question registry rather than restating it, so cutting or
// adding a question cannot leave the spec asserting on a question the form no
// longer asks -- which is exactly what happened to the first version of this
// file when two questions were removed.
const valid_submission = {
  candidate_name: 'Casey Rivera',
  contact_email: 'casey@example.com',
  contact_handle: 'casey#1234',
  timezone_name: 'America/Denver',
  has_affirmed_commitment: true,
  // A choice question only accepts its own vocabulary, so the fixture answers
  // each one with a real option rather than prose.
  ...Object.fromEntries(
    questions.map((question) => [
      question.id,
      question.options ? question.options[0] : `An answer to ${question.id}.`
    ])
  )
}

// The first FREE-TEXT question, used by the length-cap case, which a choice
// question cannot exercise.
const first_question = questions.find((question) => !question.options)
const first_choice_question = questions.find((question) => question.options)

const submit = (body) =>
  chai_request.execute(server).post('/api/waitlist').send(body)

const request_edit_link = (body) =>
  chai_request.execute(server).post('/api/waitlist/edit-link').send(body)

const read_submission = (token) =>
  chai_request
    .execute(server)
    .get(`/api/waitlist/submission?token=${encodeURIComponent(token)}`)

const edit = (body) =>
  chai_request.execute(server).put('/api/waitlist').send(body)

// Resend (libs-server/send-email.mjs) POSTs to api.resend.com over the global
// `fetch`. Replacing it captures every outbound message and guarantees the
// suite makes no network call, which is what lets a case read the token the
// route actually emailed -- the same mechanism test/auth.spec.mjs uses for the
// password reset link, and the only way to exercise the emailed edit link
// without restating the route's own token derivation in the spec.
const RESEND_API_PREFIX = 'https://api.resend.com/'
const original_fetch = globalThis.fetch
let sent_emails = []

const install_email_capture = () => {
  sent_emails = []
  globalThis.fetch = async (resource, options) => {
    if (!String(resource).startsWith(RESEND_API_PREFIX)) {
      return original_fetch(resource, options)
    }
    sent_emails.push(JSON.parse(options.body))
    return new Response(JSON.stringify({ id: 'captured-by-test' }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    })
  }
}

// A JWT is three base64url segments. Anchoring on that shape rather than on a
// looser character class keeps the sentence's trailing punctuation out of the
// token.
const extract_edit_token = (email) => {
  const match = String(email.text).match(
    /waitlist\?token=([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)/
  )
  return match ? match[1] : null
}

// Submits and returns the token from the link the route emailed, which is the
// only way a candidate ever reaches his own row.
const submit_and_read_token = async (body = valid_submission) => {
  const response = await submit(body)
  response.should.have.status(200)
  const email = sent_emails[sent_emails.length - 1]
  expect(email, 'the submit route emailed nothing').to.not.equal(undefined)
  return extract_edit_token(email)
}

describe('WAITLIST', function () {
  before(async function () {
    this.timeout(60 * 1000)
    MockDate.set(regular_season_start.subtract('1', 'month').toISOString())
    await knex.seed.run()
    await users(knex)
    await league(knex)
    install_email_capture()
  })

  beforeEach(async function () {
    // A candidate named on an Admission Vote is referenced with ON DELETE
    // RESTRICT, so those rows have to go first or the submission delete below
    // fails. Scoped to candidates that name a submission, which is what the
    // lock case creates.
    await knex('admission_vote_candidates').whereNotNull('submission_id').del()
    // manager_waitlist_submissions is not league-scoped, so it is deliberately
    // absent from db/fixtures/reset-league-tables.mjs -- which means clearing it
    // is this spec's own job. A leftover row would otherwise be read by the next
    // spec file that looks at the table.
    await knex('manager_waitlist_submissions').del()
    // The limiters are deliberately NOT disabled under test -- see the stores'
    // comment in api/routes/waitlist.mjs -- so every case starts them fresh
    // rather than sharing one per-IP budget across the whole file.
    await submit_rate_limit_store.resetAll()
    await edit_link_rate_limit_store.resetAll()
    await edit_rate_limit_store.resetAll()
    sent_emails = []
  })

  after(function () {
    globalThis.fetch = original_fetch
    sent_emails = []
    MockDate.reset()
  })

  describe('POST /api/waitlist', function () {
    it('records a submission from an anonymous caller', async function () {
      const response = await submit(valid_submission)
      response.should.have.status(200)
      response.body.success.should.equal(true)

      const rows = await knex('manager_waitlist_submissions')
      rows.length.should.equal(1)
      rows[0].candidate_name.should.equal(valid_submission.candidate_name)
      rows[0].has_affirmed_commitment.should.equal(true)
      rows[0].questionnaire_version.should.equal(
        manager_waitlist_questionnaire_version
      )

      // Every question the registry defines is stored under its id, and
      // NOTHING ELSE is -- the key set is asserted exactly so a stray body key
      // written through into a schemaless column fails here.
      Object.keys(rows[0].responses)
        .sort()
        .should.deep.equal(questions.map((question) => question.id).sort())
      rows[0].responses[first_question.id].should.equal(
        valid_submission[first_question.id]
      )
    })

    it('stores an absent optional answer as null', async function () {
      const without_optionals = { ...valid_submission }
      delete without_optionals.contact_handle

      const response = await submit(without_optionals)
      response.should.have.status(200)

      const rows = await knex('manager_waitlist_submissions')
      expect(rows[0].contact_handle).to.equal(null)
    })

    // requested_seat was retired from the form, so a stale client or a hand
    // poster sending it must not write it. The column still exists for
    // historical rows, which is why the assertion is on a stored null rather
    // than on the column being absent.
    it('drops the retired requested_seat key', async function () {
      const response = await submit({
        ...valid_submission,
        requested_seat: 'Should not be stored'
      })
      response.should.have.status(200)

      const rows = await knex('manager_waitlist_submissions')
      expect(rows[0].requested_seat).to.equal(null)
    })

    // A contact field and a question fail an omission DIFFERENTLY, and both
    // shapes are load-bearing. A contact field is a real column, so it is
    // written as null; an unanswered question writes no key at all, which is
    // the same absence a submission from an earlier question set has, and is
    // what lets the managers' page render both as a skipped block rather than
    // as an empty heading.
    it('omits an unanswered optional question from responses', async function () {
      const optional_questions = questions.filter(
        (question) => !question.required
      )
      expect(optional_questions.length).to.be.above(0)

      const without_optionals = { ...valid_submission }
      for (const question of optional_questions) {
        delete without_optionals[question.id]
      }

      const response = await submit(without_optionals)
      response.should.have.status(200)

      const rows = await knex('manager_waitlist_submissions')
      Object.keys(rows[0].responses)
        .sort()
        .should.deep.equal(
          questions
            .filter((question) => question.required)
            .map((question) => question.id)
            .sort()
        )
    })

    it('refuses a missing required answer', async function () {
      const incomplete = { ...valid_submission }
      delete incomplete[first_question.id]

      const response = await submit(incomplete)
      response.should.have.status(400)
      response.body.error.should.equal(`Missing ${first_question.id}`)

      const rows = await knex('manager_waitlist_submissions')
      rows.length.should.equal(0)
    })

    // The affirmation replaced a "how many years will you commit?" question, so
    // it is the only field where a caller's value is a promise rather than an
    // opinion. `!== true` is what stops a string 'false' reading as yes.
    it('refuses a submission that does not affirm the commitment', async function () {
      for (const value of [false, undefined, 'false', 'true', 1]) {
        const body = { ...valid_submission, has_affirmed_commitment: value }
        const response = await submit(body)
        response.should.have.status(400)
        response.body.error.should.match(/^You must confirm: /)
      }

      const rows = await knex('manager_waitlist_submissions')
      rows.length.should.equal(0)
    })

    // A select is only a suggestion until the server enforces it — anyone can
    // post by hand — and these two questions exist to be COMPARABLE, which
    // arbitrary prose in them would destroy.
    it('refuses a choice answer outside its vocabulary', async function () {
      const response = await submit({
        ...valid_submission,
        [first_choice_question.id]: 'about nine hours give or take'
      })
      response.should.have.status(400)
      response.body.error.should.equal(
        `${first_choice_question.id} is not one of the choices`
      )

      const rows = await knex('manager_waitlist_submissions')
      rows.length.should.equal(0)
    })

    // The responses column is schemaless, so what keeps it from becoming a
    // dumping ground is the route storing only ids the registry defines.
    it('drops a body key that is not a known question', async function () {
      const response = await submit({
        ...valid_submission,
        not_a_question: 'should not be stored'
      })
      response.should.have.status(200)

      const rows = await knex('manager_waitlist_submissions')
      expect(rows[0].responses.not_a_question).to.equal(undefined)
    })

    it('refuses an answer past the length cap', async function () {
      const response = await submit({
        ...valid_submission,
        [first_question.id]: 'x'.repeat(first_question.max + 1)
      })
      response.should.have.status(400)
      response.body.error.should.equal(`${first_question.id} is too long`)
    })

    it('refuses an unusable contact email', async function () {
      const response = await submit({
        ...valid_submission,
        contact_email: 'not-an-email'
      })
      response.should.have.status(400)
      response.body.error.should.equal('Invalid contact_email')
    })

    it('refuses submissions past the daily cap from one address', async function () {
      for (let attempt = 0; attempt < SUBMISSIONS_PER_DAY; attempt++) {
        const allowed = await submit(valid_submission)
        allowed.should.have.status(200)
      }

      const refused = await submit(valid_submission)
      refused.should.have.status(429)

      const rows = await knex('manager_waitlist_submissions')
      rows.length.should.equal(SUBMISSIONS_PER_DAY)
    })

    // The honeypot answers 200 so a bot cannot learn which field caught it.
    // That makes the STORED ROW the only observable, which is why this asserts
    // on the table rather than on the status.
    it('silently drops a submission that filled the honeypot', async function () {
      const response = await submit({
        ...valid_submission,
        league_website: 'http://spam.example.com'
      })
      response.should.have.status(200)
      response.body.success.should.equal(true)

      const rows = await knex('manager_waitlist_submissions')
      rows.length.should.equal(0)
    })

    // The emailed link is the whole identity mechanism: the form is anonymous,
    // so possession of the address is the only thing that distinguishes the
    // candidate from anyone else who can post here. The token is deliberately
    // NOT in the response body, which this asserts rather than assumes.
    it('emails the candidate a link back to the application', async function () {
      const response = await submit(valid_submission)
      response.should.have.status(200)

      sent_emails.length.should.equal(1)
      sent_emails[0].to.should.equal(valid_submission.contact_email)
      expect(extract_edit_token(sent_emails[0])).to.not.equal(null)
      JSON.stringify(response.body).should.not.include('token')
    })

    // A honeypot submission writes no row, so there is nothing to email a link
    // for -- and a bot that gets mail addressed to whoever it named has been
    // handed a way to send mail through this route.
    it('emails nothing for a submission that filled the honeypot', async function () {
      const response = await submit({
        ...valid_submission,
        league_website: 'http://spam.example.com'
      })
      response.should.have.status(200)

      sent_emails.length.should.equal(0)
    })
  })

  describe('POST /api/waitlist/edit-link', function () {
    it('emails the link for an address that has applied', async function () {
      await submit(valid_submission)
      sent_emails = []

      const response = await request_edit_link({
        contact_email: valid_submission.contact_email
      })
      response.should.have.status(200)

      sent_emails.length.should.equal(1)
      sent_emails[0].to.should.equal(valid_submission.contact_email)
      expect(extract_edit_token(sent_emails[0])).to.not.equal(null)
    })

    // The one that matters. Answering differently for an unknown address makes
    // this route an oracle for who has applied to a private league, which is
    // exactly the fact the questionnaire is confidential about.
    it('answers identically for an address that has not applied', async function () {
      await submit(valid_submission)
      sent_emails = []

      const known = await request_edit_link({
        contact_email: valid_submission.contact_email
      })
      const unknown = await request_edit_link({
        contact_email: 'nobody@example.com'
      })

      unknown.should.have.status(known.status)
      JSON.stringify(unknown.body).should.equal(JSON.stringify(known.body))
      // The distinguishing fact is in the mailbox, which the caller cannot see.
      sent_emails.length.should.equal(1)
      sent_emails[0].to.should.equal(valid_submission.contact_email)
    })

    it('emails the newest application when an address applied twice', async function () {
      await submit(valid_submission)
      await submit({ ...valid_submission, candidate_name: 'Second Attempt' })
      sent_emails = []

      const response = await request_edit_link({
        contact_email: valid_submission.contact_email
      })
      response.should.have.status(200)

      const token = extract_edit_token(sent_emails[0])
      const read = await read_submission(token)
      read.should.have.status(200)
      read.body.candidate_name.should.equal('Second Attempt')
    })

    it('refuses a request with no contact_email', async function () {
      const response = await request_edit_link({})
      response.should.have.status(400)
      response.body.error.should.equal('Missing contact_email')
    })

    it('refuses link requests past the daily cap from one address', async function () {
      await submit(valid_submission)

      for (let attempt = 0; attempt < EDIT_LINK_REQUESTS_PER_DAY; attempt++) {
        const allowed = await request_edit_link({
          contact_email: valid_submission.contact_email
        })
        allowed.should.have.status(200)
      }

      const refused = await request_edit_link({
        contact_email: valid_submission.contact_email
      })
      refused.should.have.status(429)
    })
  })

  describe('GET /api/waitlist/submission', function () {
    it('returns the application the token names', async function () {
      const token = await submit_and_read_token()

      const response = await read_submission(token)
      response.should.have.status(200)
      response.body.candidate_name.should.equal(valid_submission.candidate_name)
      response.body.contact_email.should.equal(valid_submission.contact_email)
      response.body.responses[first_question.id].should.equal(
        valid_submission[first_question.id]
      )
      response.body.is_locked.should.equal(false)
    })

    it('returns only the application its own token names', async function () {
      const first_token = await submit_and_read_token()
      await submit({
        ...valid_submission,
        candidate_name: 'Someone Else',
        contact_email: 'someone.else@example.com'
      })

      const response = await read_submission(first_token)
      response.should.have.status(200)
      response.body.candidate_name.should.equal(valid_submission.candidate_name)
    })

    // An anonymous caller with no token reaches no row, which is the property
    // that lets this route sit above the blanket auth guard at all.
    it('refuses a caller with no token, and a forged one', async function () {
      await submit(valid_submission)

      for (const token of ['', 'not-a-token', 'a.b.c']) {
        const response = await read_submission(token)
        response.should.have.status(401)
        JSON.stringify(response.body).should.not.include(
          valid_submission.contact_email
        )
      }
    })

    // Every token in this system is signed with the SAME secret, so a signature
    // check alone would accept anything this app ever minted. The second token
    // below is the one that matters: it is validly signed and names a real
    // submission, and only the purpose refuses it -- the session token is
    // refused by its empty payload either way, so it cannot prove the guard.
    it('refuses a validly signed token that is not an edit token', async function () {
      await submit(valid_submission)
      const submission = await knex('manager_waitlist_submissions').first()

      const forged_tokens = [
        jwt.sign({ userId: 1 }, config.jwt.secret),
        jwt.sign(
          { submission_id: submission.submission_id },
          config.jwt.secret
        ),
        jwt.sign(
          {
            submission_id: submission.submission_id,
            purpose: 'something_else'
          },
          config.jwt.secret
        )
      ]

      for (const token of forged_tokens) {
        const response = await read_submission(token)
        response.should.have.status(401)
        JSON.stringify(response.body).should.not.include(
          valid_submission.contact_email
        )
      }
    })

    it('answers 404 once the application is gone', async function () {
      const token = await submit_and_read_token()
      await knex('manager_waitlist_submissions').del()

      const response = await read_submission(token)
      response.should.have.status(404)
    })
  })

  describe('PUT /api/waitlist', function () {
    it('replaces the answers of the application the token names', async function () {
      const token = await submit_and_read_token()

      const response = await edit({
        ...valid_submission,
        token,
        candidate_name: 'Casey Rivera-Smith',
        [first_question.id]: 'A rewritten answer.'
      })
      response.should.have.status(200)

      // ONE row, still. An edit that wrote a second application would leave the
      // managers reading two cards for one candidate.
      const rows = await knex('manager_waitlist_submissions')
      rows.length.should.equal(1)
      rows[0].candidate_name.should.equal('Casey Rivera-Smith')
      rows[0].responses[first_question.id].should.equal('A rewritten answer.')
    })

    it('clears an optional answer the edit leaves out', async function () {
      const optional_question = questions.find((question) => !question.required)
      const token = await submit_and_read_token()

      const without_optional = { ...valid_submission, token }
      delete without_optional[optional_question.id]

      const response = await edit(without_optional)
      response.should.have.status(200)

      const rows = await knex('manager_waitlist_submissions')
      expect(rows[0].responses[optional_question.id]).to.equal(undefined)
    })

    // The edit path validates through the same implementation as the submit
    // path, so a body a submission would be refused for cannot be stored by
    // going around the form.
    it('refuses an edit the submit route would refuse, and stores nothing', async function () {
      const token = await submit_and_read_token()

      const response = await edit({
        ...valid_submission,
        token,
        [first_choice_question.id]: 'about nine hours give or take'
      })
      response.should.have.status(400)

      const rows = await knex('manager_waitlist_submissions')
      rows[0].responses[first_choice_question.id].should.equal(
        valid_submission[first_choice_question.id]
      )
    })

    it('refuses an edit with no token, and a forged one', async function () {
      await submit(valid_submission)

      for (const token of [undefined, 'not-a-token', 'a.b.c']) {
        const response = await edit({ ...valid_submission, token })
        response.should.have.status(401)
      }

      const rows = await knex('manager_waitlist_submissions')
      rows[0].candidate_name.should.equal(valid_submission.candidate_name)
    })

    // A token names ONE submission, so holding one is not a credential for the
    // table. This is the case that would fail if the row were resolved from
    // anything the caller sends alongside the token.
    it('cannot reach another candidate application', async function () {
      const first_token = await submit_and_read_token()
      await submit({
        ...valid_submission,
        candidate_name: 'Someone Else',
        contact_email: 'someone.else@example.com'
      })

      const response = await edit({
        ...valid_submission,
        token: first_token,
        candidate_name: 'Overwritten'
      })
      response.should.have.status(200)

      const other = await knex('manager_waitlist_submissions')
        .where({ contact_email: 'someone.else@example.com' })
        .first()
      other.candidate_name.should.equal('Someone Else')
    })

    // Once the managers are ranking the answers, they are no longer the
    // candidate's to change -- a vote on text that moved underneath it is not a
    // vote on anything.
    it('refuses an edit once the application is named on an admission vote', async function () {
      const token = await submit_and_read_token()
      const submission = await knex('manager_waitlist_submissions').first()

      const [vote] = await knex('admission_votes')
        .insert({
          league_id,
          season_year: current_season.year,
          opened_at: new Date(),
          closes_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
          maximum_ranked_candidates: 3,
          vote_status: 'open'
        })
        .returning('admission_vote_id')

      await knex('admission_vote_candidates').insert({
        admission_vote_id: vote.admission_vote_id,
        candidate_name: submission.candidate_name,
        submission_id: submission.submission_id
      })

      const response = await edit({
        ...valid_submission,
        token,
        candidate_name: 'Too Late'
      })
      response.should.have.status(409)

      const rows = await knex('manager_waitlist_submissions')
      rows[0].candidate_name.should.equal(valid_submission.candidate_name)

      // The application stays READABLE, so the page can say why rather than
      // rendering a form whose save would be refused.
      const read = await read_submission(token)
      read.should.have.status(200)
      read.body.is_locked.should.equal(true)

      await knex('admission_vote_candidates')
        .where({ admission_vote_id: vote.admission_vote_id })
        .del()
      await knex('admission_votes')
        .where({ admission_vote_id: vote.admission_vote_id })
        .del()
    })
  })

  describe('GET /api/waitlist-submissions', function () {
    beforeEach(async function () {
      await submit(valid_submission)
    })

    // The one that matters. The route mounts below the blanket auth guard
    // precisely so this can never depend on a predicate in the handler.
    it('refuses an anonymous caller', async function () {
      const response = await chai_request
        .execute(server)
        .get(`/api/waitlist-submissions?league_id=${league_id}`)

      response.should.have.status(401)
      // No answer leaks through the refusal.
      expect(response.body.candidate_name).to.equal(undefined)
      JSON.stringify(response.body).should.not.include(
        valid_submission.contact_email
      )
    })

    it('refuses a caller who manages no team in the league', async function () {
      // user1 manages a team in league 1 and none in league 2, so this
      // exercises the membership predicate rather than the guard above it.
      const response = await chai_request
        .execute(server)
        .get('/api/waitlist-submissions?league_id=2')
        .set('Authorization', `Bearer ${user1}`)

      response.should.have.status(403)
      JSON.stringify(response.body).should.not.include(
        valid_submission.contact_email
      )
    })

    it('refuses a request with no league_id', async function () {
      const response = await chai_request
        .execute(server)
        .get('/api/waitlist-submissions')
        .set('Authorization', `Bearer ${user1}`)

      response.should.have.status(400)
    })

    it('returns every submission to a manager of the league', async function () {
      const response = await chai_request
        .execute(server)
        .get(`/api/waitlist-submissions?league_id=${league_id}`)
        .set('Authorization', `Bearer ${user1}`)

      response.should.have.status(200)
      response.body.length.should.equal(1)
      response.body[0].candidate_name.should.equal(
        valid_submission.candidate_name
      )
      response.body[0].contact_email.should.equal(
        valid_submission.contact_email
      )
      response.body[0].responses[first_question.id].should.equal(
        valid_submission[first_question.id]
      )
    })

    it('returns submissions newest first', async function () {
      await submit({ ...valid_submission, candidate_name: 'Second Applicant' })

      const response = await chai_request
        .execute(server)
        .get(`/api/waitlist-submissions?league_id=${league_id}`)
        .set('Authorization', `Bearer ${user1}`)

      response.should.have.status(200)
      response.body.length.should.equal(2)
      // Both rows are stamped by the database default under a frozen clock, so
      // ordering is asserted on the identity column the sequence hands out
      // rather than on the timestamps, which can tie.
      const ids = response.body.map((row) => row.submission_id)
      ids[0].should.be.above(ids[1])
    })
  })
})
