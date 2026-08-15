/* global describe before it after */
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
import jwt from 'jsonwebtoken'
import config from '#config'

chai.use(chai_http)
chai.should()
const expect = chai.expect

const league_id = 1
const day_in_milliseconds = 24 * 60 * 60 * 1000

// test/fixtures/token.mjs carries three tokens and a ten-Team vote needs more.
// Minted here rather than added to that fixture, which every other spec file
// reads -- this is the same one-line payload POST /auth/login signs.
const token_for = (user_id) => jwt.sign({ userId: user_id }, config.jwt.secret)

const [
  commissioner_token,
  team2_token,
  team3_token,
  team4_token,
  team5_token,
  vacant_team_token,
  team2_second_userid_token
] = [1, 2, 3, 4, 5, 9, 11].map(token_for)

// A WHOLE ADMISSION VOTE, END TO END, in the shape the real one will run: ten
// Teams with the vacant one struck from the snapshot, a Team carrying two
// userids, a four-Candidate field, ballots of one, two and three preferences, a
// ballot the Commissioner transcribed, a tie at the top of the ranking, and a
// second vote that nobody decides and so reaches the Section 11(a) deemed pass.
//
// The per-case specs pin each rule against a minimal fixture. This one exists
// because the rules interact: the tie only matters once real ballots of
// differing length have produced it, the two-userid Team only matters once both
// of its userids have submitted, and the deemed pass only matters after a close
// that actually happened. It is also the standing check that no surface renders
// an individual ballot or a per-Team row once there is a full vote to leak.

// Teams 1..10 are the league; Team 9 is the Vacancy and is struck. Teams 11 and
// 12 exist in the fixture and are deliberately outside this vote.
const eligible_team_ids = [1, 2, 3, 4, 5, 6, 7, 8, 10]
const vacant_team_id = 9

const post = ({ path, token, body }) =>
  chai_request
    .execute(server)
    .post(`/api/admission-votes${path}`)
    .set('Authorization', `Bearer ${token}`)
    .send({ league_id, ...body })

const read_vote = ({ token }) =>
  chai_request
    .execute(server)
    .get(`/api/admission-votes?league_id=${league_id}`)
    .set('Authorization', `Bearer ${token}`)

const get_candidate_ids = async (admission_vote_id) => {
  const rows = await knex('admission_vote_candidates').where({
    admission_vote_id
  })
  return Object.fromEntries(
    rows.map((row) => [row.candidate_name, row.admission_vote_candidate_id])
  )
}

describe('ADMISSION VOTE END TO END', function () {
  before(async function () {
    this.timeout(60 * 1000)
    MockDate.set(current_season.regular_season_start.toISOString())
    await knex.seed.run()
    await users(knex)
    await league(knex)

    await knex('admission_vote_ballot_preferences').del()
    await knex('admission_vote_ballots').del()
    await knex('admission_vote_candidate_sponsors').del()
    await knex('admission_vote_candidates').del()
    await knex('admission_vote_eligible_teams').del()
    await knex('admission_votes').del()

    // Team 2 carries TWO userids. This is real in the live league — two Teams
    // do — and it is the whole reason ballots key on team_id rather than on
    // userid. User 11 keeps his own Team 11, which is outside this vote's
    // snapshot, so Team 2 is his only eligible Team here.
    await knex('users_teams').insert({
      userid: 11,
      tid: 2,
      season_year: current_season.year
    })
  })

  after(async () => {
    await knex('admission_vote_ballot_preferences').del()
    await knex('admission_vote_ballots').del()
    await knex('admission_vote_candidate_sponsors').del()
    await knex('admission_vote_candidates').del()
    await knex('admission_vote_eligible_teams').del()
    await knex('admission_votes').del()
    await knex('users_teams').where({ userid: 11, tid: 2 }).del()
    MockDate.reset()
  })

  let admission_vote_id
  let candidate_ids

  it('opens with the vacant team struck from the eligibility snapshot', async () => {
    const response = await post({
      path: '/',
      token: commissioner_token,
      body: {
        maximum_ranked_candidates: 3,
        closes_at: new Date(Date.now() + 3 * day_in_milliseconds).toISOString(),
        eligible_teams: eligible_team_ids.map((team_id) => ({ team_id })),
        candidates: [
          { candidate_name: 'Alice', sponsor_team_ids: [1, 3] },
          { candidate_name: 'Bob', sponsor_team_ids: [2] },
          { candidate_name: 'Carol', sponsor_team_ids: [5] },
          { candidate_name: 'Dave', sponsor_team_ids: [4] }
        ]
      }
    })

    response.should.have.status(200)
    admission_vote_id = response.body.admission_vote_id
    candidate_ids = await get_candidate_ids(admission_vote_id)

    const snapshot = await knex('admission_vote_eligible_teams').where({
      admission_vote_id
    })
    expect(snapshot).to.have.length(9)
    expect(
      snapshot.map((row) => row.team_id).includes(vacant_team_id)
    ).to.equal(false)
  })

  // Section 10(c): "A Team without a Manager shall not vote." Team 9 carries a
  // live users_teams row like every other Team, so nothing but the snapshot can
  // refuse it — which is exactly why the snapshot is explicit.
  it('refuses a ballot from the vacant team even though it has a users_teams row', async () => {
    const rows = await knex('users_teams').where({
      tid: vacant_team_id,
      season_year: current_season.year
    })
    expect(rows.length).to.be.greaterThan(0)

    const response = await post({
      path: `/${admission_vote_id}/ballot`,
      token: vacant_team_token,
      body: { ranked_candidate_ids: [candidate_ids.Alice] }
    })

    response.should.have.status(403)
    expect(response.body.error).to.include('not entitled to a ballot')
  })

  it('takes ballots of differing length, one per team', async () => {
    // Team 1 ranks one.
    ;(
      await post({
        path: `/${admission_vote_id}/ballot`,
        token: commissioner_token,
        body: { ranked_candidate_ids: [candidate_ids.Alice] }
      })
    ).should.have.status(200)

    // Team 3 ranks the full three.
    ;(
      await post({
        path: `/${admission_vote_id}/ballot`,
        token: team3_token,
        body: {
          ranked_candidate_ids: [
            candidate_ids.Alice,
            candidate_ids.Carol,
            candidate_ids.Dave
          ]
        }
      })
    ).should.have.status(200)

    // Team 5 ranks one.
    ;(
      await post({
        path: `/${admission_vote_id}/ballot`,
        token: team5_token,
        body: { ranked_candidate_ids: [candidate_ids.Carol] }
      })
    ).should.have.status(200)
  })

  // The two-userid case. Both hold Team 2; the second submission REPLACES the
  // first rather than adding a second ballot, because the key is the Team.
  it('gives a team with two userids exactly one ballot', async () => {
    ;(
      await post({
        path: `/${admission_vote_id}/ballot`,
        token: team2_token,
        body: { ranked_candidate_ids: [candidate_ids.Carol] }
      })
    ).should.have.status(200)
    ;(
      await post({
        path: `/${admission_vote_id}/ballot`,
        token: team2_second_userid_token,
        body: { ranked_candidate_ids: [candidate_ids.Bob] }
      })
    ).should.have.status(200)

    const ballots = await knex('admission_vote_ballots').where({
      admission_vote_id,
      team_id: 2
    })
    expect(ballots).to.have.length(1)

    const preferences = await knex('admission_vote_ballot_preferences').where({
      admission_vote_id,
      team_id: 2
    })
    expect(preferences).to.have.length(1)
    expect(preferences[0].admission_vote_candidate_id).to.equal(
      candidate_ids.Bob
    )
  })

  it('records a transcribed ballot with its reason', async () => {
    const response = await post({
      path: `/${admission_vote_id}/transcribed-ballot`,
      token: commissioner_token,
      body: {
        team_id: 4,
        ranked_candidate_ids: [candidate_ids.Bob, candidate_ids.Dave],
        commissioner_entered_reason: 'sent his ranking by text, locked out'
      }
    })

    response.should.have.status(200)
  })

  it('discloses nothing at all while the vote is open', async () => {
    for (const token of [commissioner_token, team2_token, team4_token]) {
      const response = await read_vote({ token })
      expect(response.body.totals).to.deep.equal([])
    }
  })

  it('closes into a tie at the top of the ranking', async () => {
    ;(
      await post({
        path: `/${admission_vote_id}/close`,
        token: commissioner_token,
        body: {}
      })
    ).should.have.status(200)

    // Alice 3 (Team 1) + 3 (Team 3) = 6
    // Bob   3 (Team 2) + 3 (Team 4) = 6   <- tied with Alice
    // Carol 2 (Team 3) + 3 (Team 5) = 5
    // Dave  1 (Team 3) + 2 (Team 4) = 3
    const response = await read_vote({ token: team4_token })
    expect(
      response.body.totals.map((row) => [row.candidate_name, row.points_total])
    ).to.deep.equal([
      ['Alice', 6],
      ['Bob', 6],
      ['Carol', 5],
      ['Dave', 3]
    ])

    expect(response.body.ballot_count).to.equal(5)
    expect(response.body.commissioner_entered_ballot_count).to.equal(1)
  })

  // The standing confidentiality check, run against a full vote rather than a
  // two-ballot fixture: five ballots exist, one of them transcribed, and no
  // caller can reach any of them.
  it('renders no individual ballot and no per-team row to any caller', async () => {
    for (const token of [
      commissioner_token,
      team2_token,
      team3_token,
      team4_token,
      team5_token
    ]) {
      const response = await read_vote({ token })
      const payload = JSON.stringify(response.body)

      expect(payload).to.not.include('preference_rank')
      expect(payload).to.not.include('commissioner_entered_reason')
      expect(payload).to.not.include('sent his ranking by text')
      expect(response.body).to.not.have.property('ballots')
    }
  })

  // Section 11(a) admits "the highest ranked Candidate"; Section 11(c) puts the
  // ranking WITHIN a tie in the commissioner's exclusive discretion. So Carol,
  // one point back, is refused, and either of the two tied at six is not.
  it('refuses a candidate below the tie and admits one of the tied pair', async () => {
    const refused = await post({
      path: `/${admission_vote_id}/decision`,
      token: commissioner_token,
      body: {
        decision_outcome: admission_vote_outcomes.ADMITTED,
        admission_vote_candidate_id: candidate_ids.Carol,
        decision_reason: 'I would rather have Carol'
      }
    })
    refused.should.have.status(400)

    const admitted = await post({
      path: `/${admission_vote_id}/decision`,
      token: commissioner_token,
      body: {
        decision_outcome: admission_vote_outcomes.ADMITTED,
        admission_vote_candidate_id: candidate_ids.Bob
      }
    })
    admitted.should.have.status(200)

    const vote = await knex('admission_votes')
      .where({ admission_vote_id })
      .first()
    expect(vote.decision_outcome).to.equal(admission_vote_outcomes.ADMITTED)
    expect(vote.decided_admission_vote_candidate_id).to.equal(candidate_ids.Bob)
  })

  // A second Vacancy runs a second vote. This one nobody decides.
  it('reaches the deemed pass on a second vote nobody decides', async function () {
    const opened = await post({
      path: '/',
      token: commissioner_token,
      body: {
        maximum_ranked_candidates: 2,
        closes_at: new Date(Date.now() + 3 * day_in_milliseconds).toISOString(),
        eligible_teams: eligible_team_ids.map((team_id) => ({ team_id })),
        candidates: [{ candidate_name: 'Erin', sponsor_team_ids: [1] }]
      }
    })
    opened.should.have.status(200)

    const second_vote_id = opened.body.admission_vote_id
    const second_candidates = await get_candidate_ids(second_vote_id)

    ;(
      await post({
        path: `/${second_vote_id}/ballot`,
        token: commissioner_token,
        body: { ranked_candidate_ids: [second_candidates.Erin] }
      })
    ).should.have.status(200)
    ;(
      await post({
        path: `/${second_vote_id}/close`,
        token: commissioner_token,
        body: {}
      })
    ).should.have.status(200)

    const before = await read_vote({ token: commissioner_token })
    expect(before.body.vote.is_deemed_passed).to.equal(false)

    MockDate.set(
      new Date(
        Date.now() +
          (admission_vote_decision_period_days + 1) * day_in_milliseconds
      ).toISOString()
    )

    const refused = await post({
      path: `/${second_vote_id}/decision`,
      token: commissioner_token,
      body: {
        decision_outcome: admission_vote_outcomes.ADMITTED,
        admission_vote_candidate_id: second_candidates.Erin
      }
    })
    refused.should.have.status(409)
    expect(refused.body.error).to.include('deemed to have passed')

    const after = await read_vote({ token: commissioner_token })
    expect(after.body.vote.vote_status).to.equal(admission_vote_statuses.CLOSED)
    // Nothing wrote the deemed pass. It IS the null outcome past the deadline.
    expect(after.body.vote.decision_outcome).to.equal(null)
    expect(after.body.vote.is_deemed_passed).to.equal(true)

    MockDate.set(current_season.regular_season_start.toISOString())
  })
})
