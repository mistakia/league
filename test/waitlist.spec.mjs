/* global describe before beforeEach it after */
import * as chai from 'chai'
import chai_http, { request as chai_request } from 'chai-http'
import MockDate from 'mockdate'

import server from '#api'
import knex from '#db'
import league from '#db/fixtures/league.mjs'
import users from '#db/fixtures/users.mjs'
import { current_season } from '#constants'
import {
  SUBMISSIONS_PER_DAY,
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

describe('WAITLIST', function () {
  before(async function () {
    this.timeout(60 * 1000)
    MockDate.set(regular_season_start.subtract('1', 'month').toISOString())
    await knex.seed.run()
    await users(knex)
    await league(knex)
  })

  beforeEach(async function () {
    // manager_waitlist_submissions is not league-scoped, so it is deliberately
    // absent from db/fixtures/reset-league-tables.mjs -- which means clearing it
    // is this spec's own job. A leftover row would otherwise be read by the next
    // spec file that looks at the table.
    await knex('manager_waitlist_submissions').del()
    // The limiter is deliberately NOT disabled under test -- see the store's
    // comment in api/routes/waitlist.mjs -- so every case starts it fresh
    // rather than sharing one per-IP budget across the whole file.
    await submit_rate_limit_store.resetAll()
  })

  after(function () {
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
