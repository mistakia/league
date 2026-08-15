/* global describe before beforeEach it after */
import * as chai from 'chai'
import chai_http, { request as chai_request } from 'chai-http'
import MockDate from 'mockdate'

import server from '#api'
import knex from '#db'
import league from '#db/fixtures/league.mjs'
import users from '#db/fixtures/users.mjs'
import { current_season } from '#constants'
import close_admission_vote from '#libs-server/close-admission-vote.mjs'
import { admission_vote_statuses } from '#libs-shared/constants/admission-vote-constants.mjs'
import { user1, user2, user3 } from './fixtures/token.mjs'

chai.use(chai_http)
chai.should()
const expect = chai.expect

const league_id = 1
const commissioner_token = user1
const manager_token = user2

// THE SECTION 10(e) DISCLOSURE, which is a constitutional right rather than a
// convenience: the Commissioner "shall show to any Manager upon request the
// number of points recorded for each Candidate". Its two limits are what this
// file pins. It is EVERY Candidate's total, not the winner's alone. And it is
// nothing at all while the vote is open, withheld by a status check rather than
// by a permission check — the same refusal reaches the Commissioner.
//
// What stays undisclosed is the thing the section actually forbids: "He shall
// not disclose how a Team voted." So the payload is swept for any per-Team
// ranking, not merely inspected for the fields the page happens to read.

const eligible_team_ids = [1, 2, 4]

const seed_vote = async ({ maximum_ranked_candidates = 3 } = {}) => {
  const opened_at = new Date()
  const closes_at = new Date(opened_at.getTime() + 3 * 24 * 60 * 60 * 1000)

  const [{ admission_vote_id }] = await knex('admission_votes')
    .insert({
      league_id,
      season_year: current_season.year,
      opened_at,
      closes_at,
      maximum_ranked_candidates,
      vote_status: admission_vote_statuses.OPEN
    })
    .returning('admission_vote_id')

  await knex('admission_vote_eligible_teams').insert(
    eligible_team_ids.map((team_id) => ({
      admission_vote_id,
      team_id,
      recorded_at: opened_at
    }))
  )

  const candidate_ids = {}
  for (const candidate_name of ['Alice', 'Bob', 'Carol']) {
    const [{ admission_vote_candidate_id }] = await knex(
      'admission_vote_candidates'
    )
      .insert({ admission_vote_id, candidate_name })
      .returning('admission_vote_candidate_id')
    candidate_ids[candidate_name] = admission_vote_candidate_id
  }

  return { admission_vote_id, candidate_ids }
}

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

const read_vote = ({ token }) =>
  chai_request
    .execute(server)
    .get(`/api/admission-votes?league_id=${league_id}`)
    .set('Authorization', `Bearer ${token}`)

const clear_vote_tables = async () => {
  await knex('admission_vote_ballot_preferences').del()
  await knex('admission_vote_ballots').del()
  await knex('admission_vote_candidate_sponsors').del()
  await knex('admission_vote_candidates').del()
  await knex('admission_vote_eligible_teams').del()
  await knex('admission_votes').del()
}

describe('ADMISSION VOTE DISCLOSURE', function () {
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

  it('refuses an unauthenticated caller', async () => {
    const response = await chai_request
      .execute(server)
      .get(`/api/admission-votes?league_id=${league_id}`)

    response.should.have.status(401)
  })

  it('refuses a caller who is not a manager of this league', async () => {
    await seed_vote()

    await knex('users_teams')
      .where({ userid: 3, season_year: current_season.year })
      .del()

    const refused = await read_vote({ token: user3 })
    refused.should.have.status(403)

    await knex('users_teams').insert({
      userid: 3,
      tid: 3,
      season_year: current_season.year
    })
  })

  // "the number of points recorded for EACH Candidate" — including the ones
  // who lost and the ones nobody ranked at all. A winner-only disclosure would
  // not satisfy the section, and the amendment's own Interpretive Note calls
  // these totals the only check offered on the tally.
  it('shows every candidate’s total to an ordinary manager after the close', async () => {
    const { admission_vote_id, candidate_ids } = await seed_vote()

    await seed_ballot({
      admission_vote_id,
      team_id: 1,
      ranked_candidate_ids: [candidate_ids.Alice, candidate_ids.Bob]
    })
    await seed_ballot({
      admission_vote_id,
      team_id: 2,
      ranked_candidate_ids: [candidate_ids.Alice]
    })

    await close_admission_vote({ admission_vote_id })

    // user2 is an ordinary manager, not the commissioner: the right belongs to
    // any Manager on request.
    const response = await read_vote({ token: manager_token })
    response.should.have.status(200)

    expect(
      response.body.totals.map((row) => [row.candidate_name, row.points_total])
    ).to.deep.equal([
      ['Alice', 6],
      ['Bob', 2],
      // ranked by nobody, and present at zero rather than absent
      ['Carol', 0]
    ])
  })

  // Sealing is a STATUS check, not a permission check, so the commissioner is
  // refused on exactly the same terms as everyone else.
  it('discloses nothing while the vote is open, to any caller', async () => {
    const { admission_vote_id, candidate_ids } = await seed_vote()

    await seed_ballot({
      admission_vote_id,
      team_id: 1,
      ranked_candidate_ids: [candidate_ids.Alice, candidate_ids.Bob]
    })

    for (const token of [manager_token, commissioner_token]) {
      const response = await read_vote({ token })
      response.should.have.status(200)
      expect(response.body.totals).to.deep.equal([])
      // The candidates themselves are the Notice and are public; only the
      // figures are sealed.
      expect(response.body.candidates).to.have.length(3)
      for (const candidate of response.body.candidates) {
        expect(candidate.points_total).to.equal(null)
      }
    }
  })

  // Section 10(e): "He shall not disclose how a Team voted." Swept over the
  // WHOLE payload rather than over the fields the page reads, so a field added
  // later that carried a ranking would fail here rather than ship.
  it('carries no per-team ranking anywhere in the payload', async () => {
    const { admission_vote_id, candidate_ids } = await seed_vote()

    await seed_ballot({
      admission_vote_id,
      team_id: 1,
      ranked_candidate_ids: [candidate_ids.Carol, candidate_ids.Alice]
    })
    await seed_ballot({
      admission_vote_id,
      team_id: 2,
      ranked_candidate_ids: [candidate_ids.Alice]
    })

    await close_admission_vote({ admission_vote_id })

    for (const token of [manager_token, commissioner_token]) {
      const response = await read_vote({ token })
      const payload = JSON.stringify(response.body)

      expect(payload).to.not.include('preference_rank')
      expect(payload).to.not.include('ballots')
      expect(payload).to.not.include('ranked_candidate_ids')

      // Turnout is an aggregate and stays one. Which teams voted is not in the
      // payload, only how many.
      expect(response.body.ballot_count).to.equal(2)
      expect(response.body).to.not.have.property('voted_team_ids')
    }
  })
})
