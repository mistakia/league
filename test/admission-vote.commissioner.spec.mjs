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
  admission_vote_statuses,
  admission_vote_outcomes,
  admission_vote_decision_period_days
} from '#libs-shared/constants/admission-vote-constants.mjs'
import { user1, user2 } from './fixtures/token.mjs'

chai.use(chai_http)
chai.should()
const expect = chai.expect

const league_id = 1
const commissioner_token = user1
const manager_token = user2
const day_in_milliseconds = 24 * 60 * 60 * 1000

const open_vote = ({
  token = commissioner_token,
  maximum_ranked_candidates = 3,
  closes_in_milliseconds = 3 * day_in_milliseconds,
  eligible_teams = [{ team_id: 1 }, { team_id: 2 }, { team_id: 4 }],
  candidates = [
    { candidate_name: 'Alice', sponsor_team_ids: [1, 2] },
    { candidate_name: 'Bob', sponsor_team_ids: [2] },
    { candidate_name: 'Carol', sponsor_team_ids: [4] }
  ]
} = {}) =>
  chai_request
    .execute(server)
    .post('/api/admission-votes')
    .set('Authorization', `Bearer ${token}`)
    .send({
      league_id,
      maximum_ranked_candidates,
      closes_at: new Date(Date.now() + closes_in_milliseconds).toISOString(),
      eligible_teams,
      candidates
    })

const close_vote = ({ admission_vote_id, token = commissioner_token }) =>
  chai_request
    .execute(server)
    .post(`/api/admission-votes/${admission_vote_id}/close`)
    .set('Authorization', `Bearer ${token}`)
    .send({ league_id })

const decide = ({
  admission_vote_id,
  token = commissioner_token,
  decision_outcome,
  admission_vote_candidate_id,
  decision_reason
}) =>
  chai_request
    .execute(server)
    .post(`/api/admission-votes/${admission_vote_id}/decision`)
    .set('Authorization', `Bearer ${token}`)
    .send({
      league_id,
      decision_outcome,
      admission_vote_candidate_id,
      decision_reason
    })

const read_vote = ({ token = commissioner_token } = {}) =>
  chai_request
    .execute(server)
    .get(`/api/admission-votes?league_id=${league_id}`)
    .set('Authorization', `Bearer ${token}`)

const submit_ballot = ({ admission_vote_id, token, ranked_candidate_ids }) =>
  chai_request
    .execute(server)
    .post(`/api/admission-votes/${admission_vote_id}/ballot`)
    .set('Authorization', `Bearer ${token}`)
    .send({ league_id, ranked_candidate_ids })

const get_candidate_ids = async (admission_vote_id) => {
  const rows = await knex('admission_vote_candidates').where({
    admission_vote_id
  })
  return Object.fromEntries(
    rows.map((row) => [row.candidate_name, row.admission_vote_candidate_id])
  )
}

// Ballots straight into the tables, so a case can build a specific tally
// without going through the eligibility of a dozen fixture users.
const seed_ballot = async ({
  admission_vote_id,
  team_id,
  ranked_candidate_ids
}) => {
  await knex('admission_vote_ballots').insert({
    admission_vote_id,
    team_id,
    submitted_at: new Date()
  })
  await knex('admission_vote_ballot_preferences').insert(
    ranked_candidate_ids.map((admission_vote_candidate_id, index) => ({
      admission_vote_id,
      team_id,
      admission_vote_candidate_id,
      preference_rank: index + 1
    }))
  )
}

const clear_vote_tables = async () => {
  await knex('admission_vote_ballot_preferences').del()
  await knex('admission_vote_ballots').del()
  await knex('admission_vote_candidate_sponsors').del()
  await knex('admission_vote_candidates').del()
  await knex('admission_vote_eligible_teams').del()
  await knex('admission_votes').del()
}

describe('ADMISSION VOTE COMMISSIONER', function () {
  before(async function () {
    this.timeout(60 * 1000)
    MockDate.set(current_season.regular_season_start.toISOString())
    await knex.seed.run()
    await users(knex)
    await league(knex)
  })

  beforeEach(clear_vote_tables)

  after(async () => {
    await clear_vote_tables()
    MockDate.reset()
  })

  describe('open', function () {
    it('writes the notice, the eligibility snapshot and the sponsors', async () => {
      const response = await open_vote()
      response.should.have.status(200)

      const { admission_vote_id } = response.body
      const vote = await knex('admission_votes')
        .where({ admission_vote_id })
        .first()
      expect(vote.vote_status).to.equal(admission_vote_statuses.OPEN)
      expect(vote.maximum_ranked_candidates).to.equal(3)
      expect(vote.decision_due_at).to.equal(null)

      const eligible = await knex('admission_vote_eligible_teams').where({
        admission_vote_id
      })
      expect(eligible.map((row) => row.team_id).sort()).to.deep.equal([1, 2, 4])

      const candidate_ids = await get_candidate_ids(admission_vote_id)
      const alice_sponsors = await knex(
        'admission_vote_candidate_sponsors'
      ).where({ admission_vote_candidate_id: candidate_ids.Alice })
      expect(alice_sponsors.map((row) => row.team_id).sort()).to.deep.equal([
        1, 2
      ])
    })

    it('refuses anyone but the commissioner', async () => {
      const response = await open_vote({ token: manager_token })
      response.should.have.status(403)
    })

    // Section 10: the stated number of Candidates a Team may rank "shall be not
    // less than one (1)".
    it('refuses a stated maximum below one', async () => {
      const response = await open_vote({ maximum_ranked_candidates: 0 })
      response.should.have.status(400)
      expect(response.body.error).to.include('at least 1')
    })

    it('refuses a vote with no candidates', async () => {
      const response = await open_vote({ candidates: [] })
      response.should.have.status(400)
    })

    it('refuses a vote with no team entitled to a ballot', async () => {
      const response = await open_vote({ eligible_teams: [] })
      response.should.have.status(400)
    })

    it('refuses an eligible team from another league', async () => {
      const response = await open_vote({
        eligible_teams: [{ team_id: 1 }, { team_id: 9999 }]
      })
      response.should.have.status(400)
      expect(response.body.error).to.include('not a team in this league')
    })

    it('refuses a second open vote in the same season', async () => {
      await open_vote()
      const response = await open_vote()
      response.should.have.status(409)
    })

    // Nothing half-lands. A vote whose snapshot only partly wrote would be open
    // and unvotable for the teams that fell in the gap.
    it('writes nothing when the candidate list is rejected', async () => {
      const response = await open_vote({
        candidates: [{ candidate_name: '   ' }]
      })
      response.should.have.status(400)

      const votes = await knex('admission_votes').where({ league_id })
      expect(votes).to.have.length(0)
    })
  })

  describe('close', function () {
    it('pins the tally and starts the seven-day clock', async () => {
      const { body } = await open_vote()
      const { admission_vote_id } = body
      const candidate_ids = await get_candidate_ids(admission_vote_id)

      await submit_ballot({
        admission_vote_id,
        token: commissioner_token,
        ranked_candidate_ids: [candidate_ids.Alice, candidate_ids.Bob]
      })
      await submit_ballot({
        admission_vote_id,
        token: manager_token,
        ranked_candidate_ids: [candidate_ids.Alice]
      })

      const response = await close_vote({ admission_vote_id })
      response.should.have.status(200)

      const vote = await knex('admission_votes')
        .where({ admission_vote_id })
        .first()
      expect(vote.vote_status).to.equal(admission_vote_statuses.CLOSED)
      expect(vote.decision_due_at.getTime()).to.equal(
        vote.closed_at.getTime() +
          admission_vote_decision_period_days * day_in_milliseconds
      )

      const read = await read_vote()
      expect(
        read.body.totals.map((row) => [row.candidate_name, row.points_total])
      ).to.deep.equal([
        ['Alice', 6],
        ['Bob', 2],
        ['Carol', 0]
      ])
    })

    it('refuses anyone but the commissioner', async () => {
      const { body } = await open_vote()
      const response = await close_vote({
        admission_vote_id: body.admission_vote_id,
        token: manager_token
      })
      response.should.have.status(403)
    })

    it('refuses a second close', async () => {
      const { body } = await open_vote()
      await close_vote({ admission_vote_id: body.admission_vote_id })
      const response = await close_vote({
        admission_vote_id: body.admission_vote_id
      })
      response.should.have.status(409)
    })
  })

  describe('decide', function () {
    const open_and_close = async ({ ballots }) => {
      const { body } = await open_vote()
      const { admission_vote_id } = body
      const candidate_ids = await get_candidate_ids(admission_vote_id)

      for (const [team_id, ranked_names] of Object.entries(ballots)) {
        await seed_ballot({
          admission_vote_id,
          team_id: Number(team_id),
          ranked_candidate_ids: ranked_names.map((name) => candidate_ids[name])
        })
      }

      await close_vote({ admission_vote_id })
      return { admission_vote_id, candidate_ids }
    }

    it('admits the highest ranked candidate', async () => {
      const { admission_vote_id, candidate_ids } = await open_and_close({
        ballots: { 1: ['Alice', 'Bob'], 2: ['Alice', 'Carol'] }
      })

      const response = await decide({
        admission_vote_id,
        decision_outcome: admission_vote_outcomes.ADMITTED,
        admission_vote_candidate_id: candidate_ids.Alice
      })

      response.should.have.status(200)

      const vote = await knex('admission_votes')
        .where({ admission_vote_id })
        .first()
      expect(vote.decision_outcome).to.equal(admission_vote_outcomes.ADMITTED)
      expect(vote.decided_admission_vote_candidate_id).to.equal(
        candidate_ids.Alice
      )
      expect(vote.decided_at).to.exist
    })

    // Section 11(a) grants two elections and no third. There is no
    // admit-someone-else action, with or without a recorded reason.
    it('refuses to admit a candidate who is not highest ranked', async () => {
      const { admission_vote_id, candidate_ids } = await open_and_close({
        ballots: { 1: ['Alice', 'Bob'], 2: ['Alice', 'Carol'] }
      })

      const response = await decide({
        admission_vote_id,
        decision_outcome: admission_vote_outcomes.ADMITTED,
        admission_vote_candidate_id: candidate_ids.Bob,
        decision_reason: 'I know Bob personally and he is the better fit'
      })

      response.should.have.status(400)
      expect(response.body.error).to.include('only the highest ranked')

      const vote = await knex('admission_votes')
        .where({ admission_vote_id })
        .first()
      expect(vote.decision_outcome).to.equal(null)
    })

    // Section 11(c) puts the ranking of tied candidates in the commissioner's
    // exclusive discretion, so either of two tied top-scorers may be admitted
    // and the admitted candidate is still the highest ranked.
    it('admits either of two candidates tied at the top', async () => {
      const { admission_vote_id, candidate_ids } = await open_and_close({
        ballots: { 1: ['Alice'], 2: ['Bob'] }
      })

      const totals = await knex('admission_vote_candidates').where({
        admission_vote_id
      })
      const points = Object.fromEntries(
        totals.map((row) => [row.candidate_name, row.points_total])
      )
      expect(points.Alice).to.equal(points.Bob)

      const response = await decide({
        admission_vote_id,
        decision_outcome: admission_vote_outcomes.ADMITTED,
        admission_vote_candidate_id: candidate_ids.Bob
      })

      response.should.have.status(200)
    })

    // Section 11(b): he "shall give Notice of the pass and of his reason
    // for it".
    it('refuses a pass with no reason', async () => {
      const { admission_vote_id } = await open_and_close({
        ballots: { 1: ['Alice'] }
      })

      const response = await decide({
        admission_vote_id,
        decision_outcome: admission_vote_outcomes.PASSED,
        decision_reason: '   '
      })

      response.should.have.status(400)
      expect(response.body.error).to.include('requires a reason')
    })

    it('records a pass with its reason', async () => {
      const { admission_vote_id } = await open_and_close({
        ballots: { 1: ['Alice'] }
      })

      const response = await decide({
        admission_vote_id,
        decision_outcome: admission_vote_outcomes.PASSED,
        decision_reason: 'the league cannot live with this field'
      })

      response.should.have.status(200)

      const vote = await knex('admission_votes')
        .where({ admission_vote_id })
        .first()
      expect(vote.decision_outcome).to.equal(admission_vote_outcomes.PASSED)
      expect(vote.decided_admission_vote_candidate_id).to.equal(null)
      expect(vote.decision_reason).to.equal(
        'the league cannot live with this field'
      )
    })

    it('refuses a third outcome', async () => {
      const { admission_vote_id } = await open_and_close({
        ballots: { 1: ['Alice'] }
      })

      const response = await decide({
        admission_vote_id,
        decision_outcome: 'admitted_someone_else',
        decision_reason: 'because'
      })

      response.should.have.status(400)
    })

    it('refuses a decision on a vote that is still open', async () => {
      const { body } = await open_vote()
      const candidate_ids = await get_candidate_ids(body.admission_vote_id)

      const response = await decide({
        admission_vote_id: body.admission_vote_id,
        decision_outcome: admission_vote_outcomes.ADMITTED,
        admission_vote_candidate_id: candidate_ids.Alice
      })

      response.should.have.status(409)
    })

    it('refuses a second decision', async () => {
      const { admission_vote_id } = await open_and_close({
        ballots: { 1: ['Alice'] }
      })

      await decide({
        admission_vote_id,
        decision_outcome: admission_vote_outcomes.PASSED,
        decision_reason: 'reopening nominations'
      })

      const response = await decide({
        admission_vote_id,
        decision_outcome: admission_vote_outcomes.PASSED,
        decision_reason: 'changed my mind'
      })

      response.should.have.status(409)
    })

    it('refuses anyone but the commissioner', async () => {
      const { admission_vote_id, candidate_ids } = await open_and_close({
        ballots: { 1: ['Alice'] }
      })

      const response = await decide({
        admission_vote_id,
        token: manager_token,
        decision_outcome: admission_vote_outcomes.ADMITTED,
        admission_vote_candidate_id: candidate_ids.Alice
      })

      response.should.have.status(403)
    })

    // Section 11(a): "where he does neither he is deemed to have passed." The
    // deemed pass is the absence of an act, so nothing writes it -- the vote
    // simply reads as deemed passed and the decision action is refused.
    it('refuses a decision past the deadline and then reads as deemed passed', async () => {
      const { admission_vote_id, candidate_ids } = await open_and_close({
        ballots: { 1: ['Alice'] }
      })

      const before_deadline = await read_vote()
      expect(before_deadline.body.vote.is_deemed_passed).to.equal(false)

      MockDate.set(
        new Date(
          Date.now() +
            (admission_vote_decision_period_days + 1) * day_in_milliseconds
        ).toISOString()
      )

      const response = await decide({
        admission_vote_id,
        decision_outcome: admission_vote_outcomes.ADMITTED,
        admission_vote_candidate_id: candidate_ids.Alice
      })

      response.should.have.status(409)
      expect(response.body.error).to.include('deemed to have passed')

      const after_deadline = await read_vote()
      expect(after_deadline.body.vote.is_deemed_passed).to.equal(true)
      expect(after_deadline.body.vote.decision_outcome).to.equal(null)

      MockDate.set(current_season.regular_season_start.toISOString())
    })
  })
})
