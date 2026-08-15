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

const valid_submission = {
  candidate_name: 'Casey Rivera',
  contact_email: 'casey@example.com',
  contact_handle: 'casey#1234',
  timezone_name: 'America/Denver',
  commitment_intent: 'Three or four years, assuming I enjoy it.',
  dynasty_experience: 'Two dynasty leagues since 2019, one with a cap.',
  salary_cap_experience:
    'Comfortable. I have run a cap league as commissioner.',
  contract_mechanics_comfort: 'Tags yes, restricted free agency not really.',
  offseason_activity: 'Very active. The offseason is the best part.',
  rules_tolerance: 'I would rather have the rule written down than argued.',
  commissioner_disagreement:
    'Ask why in the league chat, accept the ruling, propose an amendment.',
  prior_league_history:
    'One league folded when the commissioner quit. The other is still running.',
  requested_seat: 'Whichever is open.'
}

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
      rows[0].prior_league_history.should.equal(
        valid_submission.prior_league_history
      )
      rows[0].questionnaire_version.should.equal(1)
    })

    it('stores an absent optional answer as null', async function () {
      const { requested_seat, contact_handle, ...without_optionals } =
        valid_submission
      expect(requested_seat).to.be.a('string')
      expect(contact_handle).to.be.a('string')

      const response = await submit(without_optionals)
      response.should.have.status(200)

      const rows = await knex('manager_waitlist_submissions')
      expect(rows[0].requested_seat).to.equal(null)
      expect(rows[0].contact_handle).to.equal(null)
    })

    it('refuses a missing required answer', async function () {
      const { prior_league_history, ...incomplete } = valid_submission
      expect(prior_league_history).to.be.a('string')

      const response = await submit(incomplete)
      response.should.have.status(400)
      response.body.error.should.equal('Missing prior_league_history')

      const rows = await knex('manager_waitlist_submissions')
      rows.length.should.equal(0)
    })

    it('refuses an answer past the length cap', async function () {
      const response = await submit({
        ...valid_submission,
        prior_league_history: 'x'.repeat(4001)
      })
      response.should.have.status(400)
      response.body.error.should.equal('prior_league_history is too long')
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
