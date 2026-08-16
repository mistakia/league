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

// THE SECTION 10(d) DISCLOSURE, which is a constitutional right rather than a
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

  // Section 10(d): "He shall not disclose how a Team voted." That forbids
  // disclosure to OTHERS, so what the payload must not carry is ANOTHER team's
  // ranking. The caller's own is returned deliberately, so replacing a ballot
  // is an edit rather than a re-entry — the operator settled that on
  // 2026-08-15, reversing the absolute rule this file used to pin.
  //
  // The two teams are given DIFFERENT rankings and each caller is checked
  // against his own, which is what gives this teeth: a handler that returned
  // one fixed team's ranking to everybody would satisfy any assertion that
  // merely looked for a ranking being present.
  it('carries the caller’s own ranking and no other team’s', async () => {
    const { admission_vote_id, candidate_ids } = await seed_vote()

    // Commissioner is user1 and holds team 1; the ordinary manager is user2 and
    // holds team 2.
    const team_1_ranking = [candidate_ids.Carol, candidate_ids.Alice]
    const team_2_ranking = [candidate_ids.Alice]

    await seed_ballot({
      admission_vote_id,
      team_id: 1,
      ranked_candidate_ids: team_1_ranking
    })
    await seed_ballot({
      admission_vote_id,
      team_id: 2,
      ranked_candidate_ids: team_2_ranking
    })

    await close_admission_vote({ admission_vote_id })

    const expectations = [
      { token: commissioner_token, own: team_1_ranking, other: team_2_ranking },
      { token: manager_token, own: team_2_ranking, other: team_1_ranking }
    ]

    for (const { token, own, other } of expectations) {
      const response = await read_vote({ token })

      // His own ranking, in preference order.
      expect(response.body.viewer.ranked_candidate_ids).to.deep.equal(own)
      // ...and it is HIS, not a fixed team's handed to every caller.
      expect(response.body.viewer.ranked_candidate_ids).to.not.deep.equal(other)

      // Nothing outside the viewer block carries a ranking at all. Swept over
      // the WHOLE payload with the viewer block removed, rather than over the
      // fields the page reads, so a field added later that carried another
      // team's ranking fails here rather than shipping.
      const { viewer, ...rest } = response.body
      const payload = JSON.stringify(rest)

      expect(payload).to.not.include('preference_rank')
      expect(payload).to.not.include('ballots')
      expect(payload).to.not.include('ranked_candidate_ids')

      // The viewer block itself names no team but the caller's own.
      expect(viewer.team_id).to.equal(token === commissioner_token ? 1 : 2)

      // Turnout is an aggregate and stays one. Which teams voted is not in the
      // payload, only how many.
      expect(response.body.ballot_count).to.equal(2)
      expect(response.body).to.not.have.property('voted_team_ids')
    }
  })

  // The Commissioner is the caller this rule is really about: he is the one
  // Section 10(d) binds, and he reaches his own ballot by the same predicate as
  // anyone else. Being commissioner grants no extra reach.
  it('gives the commissioner no ranking but his own', async () => {
    const { admission_vote_id, candidate_ids } = await seed_vote()

    // Team 4 votes; the commissioner's own team 1 does not.
    await seed_ballot({
      admission_vote_id,
      team_id: 4,
      ranked_candidate_ids: [candidate_ids.Bob, candidate_ids.Carol]
    })

    await close_admission_vote({ admission_vote_id })

    const response = await read_vote({ token: commissioner_token })

    // He cast no ballot, so there is nothing of his own to render — and team
    // 4's ranking is not his to see.
    expect(response.body.viewer.has_submitted_ballot).to.equal(false)
    expect(response.body.viewer.ranked_candidate_ids).to.deep.equal([])
    expect(response.body.ballot_count).to.equal(1)
  })
})
