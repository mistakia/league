/* global describe before beforeEach it after */
import * as chai from 'chai'
import chai_http, { request as chai_request } from 'chai-http'
import MockDate from 'mockdate'

import server from '#api'
import knex from '#db'
import league from '#db/fixtures/league.mjs'
import users from '#db/fixtures/users.mjs'
import { current_season } from '#constants'
import write_admission_vote_ballot from '#libs-server/write-admission-vote-ballot.mjs'
import { admission_vote_statuses } from '#libs-shared/constants/admission-vote-constants.mjs'
import { user1, user2, user3 } from './fixtures/token.mjs'

chai.use(chai_http)
chai.should()
const expect = chai.expect

const league_id = 1

// user1 is league 1's commissioner and holds team 1; user2 holds team 2. Team 3
// is deliberately left OUT of the eligibility snapshot below, standing for the
// vacant Team that Section 10(c) bars from voting; user3 holds it.
const commissioner_token = user1
const manager_token = user2
const commissioner_team_id = 1
const manager_team_id = 2
const ineligible_team_id = 3

const eligible_team_ids = [1, 2, 4]

const seed_vote = async ({
  maximum_ranked_candidates = 3,
  closes_in_milliseconds = 3 * 24 * 60 * 60 * 1000
} = {}) => {
  const opened_at = new Date()
  const closes_at = new Date(opened_at.getTime() + closes_in_milliseconds)

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

  // Section 9(c): an individual nominated by more than one Manager is one
  // Candidate, and each nominating Manager is a Sponsor.
  await knex('admission_vote_candidate_sponsors').insert([
    {
      admission_vote_candidate_id: candidate_ids.Alice,
      team_id: commissioner_team_id
    },
    {
      admission_vote_candidate_id: candidate_ids.Alice,
      team_id: manager_team_id
    },
    { admission_vote_candidate_id: candidate_ids.Bob, team_id: manager_team_id }
  ])

  return { admission_vote_id, closes_at, candidate_ids }
}

const read_vote = ({ token = manager_token } = {}) =>
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

const transcribe_ballot = ({
  admission_vote_id,
  token = commissioner_token,
  team_id,
  ranked_candidate_ids,
  commissioner_entered_reason
}) =>
  chai_request
    .execute(server)
    .post(`/api/admission-votes/${admission_vote_id}/transcribed-ballot`)
    .set('Authorization', `Bearer ${token}`)
    .send({
      league_id,
      team_id,
      ranked_candidate_ids,
      commissioner_entered_reason
    })

const read_preferences = ({ admission_vote_id, team_id }) =>
  knex('admission_vote_ballot_preferences')
    .where({ admission_vote_id, team_id })
    .orderBy('preference_rank', 'asc')

const clear_vote_tables = async () => {
  await knex('admission_vote_ballot_preferences').del()
  await knex('admission_vote_ballots').del()
  await knex('admission_vote_candidate_sponsors').del()
  await knex('admission_vote_candidates').del()
  await knex('admission_vote_eligible_teams').del()
  await knex('admission_votes').del()
}

describe('ADMISSION VOTE BALLOT', function () {
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

  describe('read', function () {
    // The blanket guard in api/index.mjs, not a predicate in this router. That
    // is the whole reason the router mounts where it does.
    it('refuses an unauthenticated caller', async () => {
      const response = await chai_request
        .execute(server)
        .get(`/api/admission-votes?league_id=${league_id}`)

      response.should.have.status(401)
    })

    it('refuses a caller who manages no team in the league', async () => {
      // user3 holds team 3 in the fixture, so dropping that row makes him a
      // stranger to this league rather than requiring an invented user. The
      // control is that the same token succeeds once the row is back.
      await knex('users_teams')
        .where({ userid: 3, season_year: current_season.year })
        .del()

      const refused = await read_vote({ token: user3 })
      refused.should.have.status(403)

      await knex('users_teams').insert({
        userid: 3,
        tid: ineligible_team_id,
        season_year: current_season.year
      })

      const allowed = await read_vote({ token: user3 })
      allowed.should.have.status(200)
    })

    it('reports no vote where the league has never held one', async () => {
      const response = await read_vote()
      response.should.have.status(200)
      expect(response.body.vote).to.equal(null)
      expect(response.body.candidates).to.deep.equal([])
      expect(response.body.totals).to.deep.equal([])
    })

    it('returns the notice with each candidate and his sponsors', async () => {
      const { admission_vote_id, candidate_ids } = await seed_vote()

      const response = await read_vote()

      response.should.have.status(200)
      expect(response.body.vote.admission_vote_id).to.equal(admission_vote_id)
      expect(response.body.vote.maximum_ranked_candidates).to.equal(3)
      expect(response.body.candidates).to.have.length(3)

      const alice = response.body.candidates.find(
        (candidate) =>
          candidate.admission_vote_candidate_id === candidate_ids.Alice
      )
      expect(
        alice.sponsors.map((sponsor) => sponsor.team_id).sort()
      ).to.deep.equal([commissioner_team_id, manager_team_id])
      // The waitlist pool is empty on a first run, so a directly nominated
      // Candidate carries no application. That is ordinary, not an error.
      expect(alice.submission_id).to.equal(null)
    })

    // Section 10(d). The response is where this is enforced: a per-Team key
    // here would be the disclosure the section forbids.
    it('never returns another team’s ranking to any caller', async () => {
      const { admission_vote_id, candidate_ids } = await seed_vote()
      await submit_ballot({
        admission_vote_id,
        token: manager_token,
        ranked_candidate_ids: [candidate_ids.Bob, candidate_ids.Alice]
      })

      // A SECOND ballot, so the leak this case is named for is detectable at
      // all. With only one ballot in the vote, a handler returning every team's
      // preferences returns exactly the caller's own and the case passes over
      // it -- the fixture, not the assertion, is what gives this its teeth.
      await write_admission_vote_ballot({
        admission_vote_id,
        team_id: 4,
        ranked_candidate_ids: [candidate_ids.Carol]
      })

      // The manager reads his own back, and nothing of team 4's.
      const own = await read_vote({ token: manager_token })
      expect(own.body.viewer.ranked_candidate_ids).to.deep.equal([
        candidate_ids.Bob,
        candidate_ids.Alice
      ])
      expect(own.body.viewer.ranked_candidate_ids).to.not.include(
        candidate_ids.Carol
      )

      // The commissioner's own team cast nothing, so he reads an empty ranking
      // rather than either of theirs — being commissioner grants no reach.
      const other = await read_vote({ token: commissioner_token })
      expect(other.body.viewer.ranked_candidate_ids).to.deep.equal([])

      for (const response of [own, other]) {
        const { viewer, ...rest } = response.body
        const payload = JSON.stringify(rest)

        expect(payload).to.not.include('preference_rank')
        expect(payload).to.not.include('ranked_candidate_ids')
        expect(response.body.ballot_count).to.equal(2)
        // Turnout is an aggregate. It says how many Teams voted, never which.
        expect(response.body).to.not.have.property('ballots')
      }
    })

    it('reports the caller his own ballot state and his own ranking', async () => {
      const { admission_vote_id, candidate_ids } = await seed_vote()

      const before_submission = await read_vote()
      expect(before_submission.body.viewer.team_id).to.equal(manager_team_id)
      expect(before_submission.body.viewer.is_eligible).to.equal(true)
      expect(before_submission.body.viewer.has_submitted_ballot).to.equal(false)
      expect(before_submission.body.viewer.ranked_candidate_ids).to.deep.equal(
        []
      )

      await submit_ballot({
        admission_vote_id,
        token: manager_token,
        ranked_candidate_ids: [candidate_ids.Alice]
      })

      const after_submission = await read_vote()
      expect(after_submission.body.viewer.has_submitted_ballot).to.equal(true)
      expect(after_submission.body.viewer.submitted_at).to.exist
      expect(after_submission.body.viewer.ranked_candidate_ids).to.deep.equal([
        candidate_ids.Alice
      ])
    })

    // WHY THE RANKING IS RETURNED AT ALL. Replacing a ballot was already
    // unlimited -- the writer deletes and re-inserts in one transaction -- but
    // with no ranking rendered it meant re-entering the whole thing from
    // scratch. This is the round trip that makes it an edit, and the ORDER is
    // what has to survive it: a ranking read back in the wrong order would
    // silently invert a manager's preferences on his next submission.
    it('reads back a replaced ranking in preference order', async () => {
      const { admission_vote_id, candidate_ids } = await seed_vote()

      await submit_ballot({
        admission_vote_id,
        token: manager_token,
        ranked_candidate_ids: [candidate_ids.Alice, candidate_ids.Bob]
      })

      const first = await read_vote()
      expect(first.body.viewer.ranked_candidate_ids).to.deep.equal([
        candidate_ids.Alice,
        candidate_ids.Bob
      ])

      // Same two candidates, opposite order. Nothing but the order changes, so
      // a read that ignored preference_rank would return the identical array
      // and pass the previous assertion.
      await submit_ballot({
        admission_vote_id,
        token: manager_token,
        ranked_candidate_ids: [candidate_ids.Bob, candidate_ids.Alice]
      })

      const second = await read_vote()
      expect(second.body.viewer.ranked_candidate_ids).to.deep.equal([
        candidate_ids.Bob,
        candidate_ids.Alice
      ])
      expect(second.body.ballot_count).to.equal(1)
    })
  })

  describe('submit', function () {
    it('records a ranked ballot bound to the caller’s team', async () => {
      const { admission_vote_id, candidate_ids } = await seed_vote()

      const response = await submit_ballot({
        admission_vote_id,
        token: manager_token,
        ranked_candidate_ids: [candidate_ids.Bob, candidate_ids.Alice]
      })

      response.should.have.status(200)

      const preferences = await read_preferences({
        admission_vote_id,
        team_id: manager_team_id
      })
      expect(
        preferences.map((row) => row.admission_vote_candidate_id)
      ).to.deep.equal([candidate_ids.Bob, candidate_ids.Alice])

      const ballot = await knex('admission_vote_ballots')
        .where({ admission_vote_id, team_id: manager_team_id })
        .first()
      expect(ballot.commissioner_entered_reason).to.equal(null)
    })

    // Section 10(c): "A Team without a Manager shall not vote." Team 3 is
    // absent from the snapshot, and row presence in users_teams cannot make it
    // eligible.
    it('refuses a team absent from the eligibility snapshot', async () => {
      const { admission_vote_id, candidate_ids } = await seed_vote()

      const response = await chai_request
        .execute(server)
        .post(`/api/admission-votes/${admission_vote_id}/ballot`)
        .set('Authorization', `Bearer ${user1}`)
        .send({ league_id, ranked_candidate_ids: [candidate_ids.Alice] })

      // control: the commissioner's own team IS in the snapshot, so this
      // succeeds and the refusal below is about eligibility, not about who is
      // asking
      response.should.have.status(200)

      await knex('admission_vote_eligible_teams')
        .where({ admission_vote_id, team_id: manager_team_id })
        .del()

      const refused = await submit_ballot({
        admission_vote_id,
        token: manager_token,
        ranked_candidate_ids: [candidate_ids.Alice]
      })

      refused.should.have.status(403)
      expect(refused.body.error).to.include('not entitled to a ballot')
    })

    it('refuses a ranking longer than the candidate count', async () => {
      const { admission_vote_id, candidate_ids } = await seed_vote({
        maximum_ranked_candidates: 2
      })

      const response = await submit_ballot({
        admission_vote_id,
        token: manager_token,
        ranked_candidate_ids: [
          candidate_ids.Alice,
          candidate_ids.Bob,
          candidate_ids.Carol
        ]
      })

      response.should.have.status(400)
      expect(response.body.error).to.include('at most 2')
    })

    it('refuses a ranking that names the same candidate twice', async () => {
      const { admission_vote_id, candidate_ids } = await seed_vote()

      const response = await submit_ballot({
        admission_vote_id,
        token: manager_token,
        ranked_candidate_ids: [candidate_ids.Alice, candidate_ids.Alice]
      })

      response.should.have.status(400)
      expect(response.body.error).to.include('only once')
    })

    it('refuses an empty ranking', async () => {
      const { admission_vote_id } = await seed_vote()

      const response = await submit_ballot({
        admission_vote_id,
        token: manager_token,
        ranked_candidate_ids: []
      })

      response.should.have.status(400)
    })

    it('refuses a submission once closes_at has passed', async () => {
      const { admission_vote_id, candidate_ids } = await seed_vote({
        closes_in_milliseconds: 1000
      })

      MockDate.set(new Date(Date.now() + 2000).toISOString())

      const response = await submit_ballot({
        admission_vote_id,
        token: manager_token,
        ranked_candidate_ids: [candidate_ids.Alice]
      })

      MockDate.set(current_season.regular_season_start.toISOString())

      response.should.have.status(409)
    })

    it('replaces a prior ballot rather than adding a second', async () => {
      const { admission_vote_id, candidate_ids } = await seed_vote()

      await submit_ballot({
        admission_vote_id,
        token: manager_token,
        ranked_candidate_ids: [candidate_ids.Alice, candidate_ids.Bob]
      })
      await submit_ballot({
        admission_vote_id,
        token: manager_token,
        ranked_candidate_ids: [candidate_ids.Carol]
      })

      const ballots = await knex('admission_vote_ballots').where({
        admission_vote_id,
        team_id: manager_team_id
      })
      expect(ballots).to.have.length(1)

      const preferences = await read_preferences({
        admission_vote_id,
        team_id: manager_team_id
      })
      expect(
        preferences.map((row) => row.admission_vote_candidate_id)
      ).to.deep.equal([candidate_ids.Carol])
    })

    // Replacement is the Manager's own act, so replacing a transcribed ballot
    // makes it his: the recorded transcription reason goes with the ballot it
    // described.
    it('clears the transcription reason when the manager replaces the ballot', async () => {
      const { admission_vote_id, candidate_ids } = await seed_vote()

      await transcribe_ballot({
        admission_vote_id,
        team_id: manager_team_id,
        ranked_candidate_ids: [candidate_ids.Alice],
        commissioner_entered_reason: 'sent by text, cannot reach the app'
      })

      await submit_ballot({
        admission_vote_id,
        token: manager_token,
        ranked_candidate_ids: [candidate_ids.Bob]
      })

      const ballot = await knex('admission_vote_ballots')
        .where({ admission_vote_id, team_id: manager_team_id })
        .first()
      expect(ballot.commissioner_entered_reason).to.equal(null)
    })

    // These writers autocommit per statement, so a delete-then-insert that
    // throws in between would leave the Team with no ballot at all. Forced here
    // by a preference row naming a candidate that does not exist, which the
    // foreign key refuses AFTER the delete and the ballot insert have run.
    it('leaves the prior ballot intact when a replacement fails mid-write', async () => {
      const { admission_vote_id, candidate_ids } = await seed_vote()

      await submit_ballot({
        admission_vote_id,
        token: manager_token,
        ranked_candidate_ids: [candidate_ids.Alice, candidate_ids.Bob]
      })

      let error
      try {
        await write_admission_vote_ballot({
          admission_vote_id,
          team_id: manager_team_id,
          ranked_candidate_ids: [candidate_ids.Carol, 999999]
        })
      } catch (caught) {
        error = caught
      }

      expect(error).to.exist

      const ballots = await knex('admission_vote_ballots').where({
        admission_vote_id,
        team_id: manager_team_id
      })
      expect(ballots).to.have.length(1)

      const preferences = await read_preferences({
        admission_vote_id,
        team_id: manager_team_id
      })
      expect(
        preferences.map((row) => row.admission_vote_candidate_id)
      ).to.deep.equal([candidate_ids.Alice, candidate_ids.Bob])
    })
  })

  describe('transcribe', function () {
    it('records a ranking the commissioner transcribed, with its reason', async () => {
      const { admission_vote_id, candidate_ids } = await seed_vote()

      const response = await transcribe_ballot({
        admission_vote_id,
        team_id: manager_team_id,
        ranked_candidate_ids: [candidate_ids.Bob, candidate_ids.Alice],
        commissioner_entered_reason: 'sent by text, cannot reach the app'
      })

      response.should.have.status(200)

      const ballot = await knex('admission_vote_ballots')
        .where({ admission_vote_id, team_id: manager_team_id })
        .first()
      expect(ballot.commissioner_entered_reason).to.equal(
        'sent by text, cannot reach the app'
      )

      // The transcribed count is visible rather than silent.
      const read = await read_vote()
      expect(read.body.commissioner_entered_ballot_count).to.equal(1)
    })

    it('refuses a transcription with no recorded reason', async () => {
      const { admission_vote_id, candidate_ids } = await seed_vote()

      const response = await transcribe_ballot({
        admission_vote_id,
        team_id: manager_team_id,
        ranked_candidate_ids: [candidate_ids.Alice],
        commissioner_entered_reason: '   '
      })

      response.should.have.status(400)
      expect(response.body.error).to.include('recorded reason')
    })

    it('refuses a transcription from anyone but the commissioner', async () => {
      const { admission_vote_id, candidate_ids } = await seed_vote()

      const response = await transcribe_ballot({
        admission_vote_id,
        token: manager_token,
        team_id: commissioner_team_id,
        ranked_candidate_ids: [candidate_ids.Alice],
        commissioner_entered_reason: 'because I say so'
      })

      response.should.have.status(403)
    })

    // Keyed on closes_at, NOT on the commissioner having pressed close, so a
    // manual close cannot widen the window in which he may write a ballot.
    it('refuses a transcription once closes_at has passed', async () => {
      const { admission_vote_id, candidate_ids } = await seed_vote({
        closes_in_milliseconds: 1000
      })

      MockDate.set(new Date(Date.now() + 2000).toISOString())

      const response = await transcribe_ballot({
        admission_vote_id,
        team_id: manager_team_id,
        ranked_candidate_ids: [candidate_ids.Alice],
        commissioner_entered_reason: 'sent by text'
      })

      MockDate.set(current_season.regular_season_start.toISOString())

      response.should.have.status(409)
      expect(response.body.error).to.include('ballot period has ended')
    })

    // The refusal that matters most: without it the one person who sees every
    // ballot could overwrite a Team's after watching the tally move.
    it('refuses a transcription for a team that already has a ballot', async () => {
      const { admission_vote_id, candidate_ids } = await seed_vote()

      await submit_ballot({
        admission_vote_id,
        token: manager_token,
        ranked_candidate_ids: [candidate_ids.Alice]
      })

      const response = await transcribe_ballot({
        admission_vote_id,
        team_id: manager_team_id,
        ranked_candidate_ids: [candidate_ids.Carol],
        commissioner_entered_reason: 'he changed his mind on the phone'
      })

      response.should.have.status(409)
      expect(response.body.error).to.include('already has a ballot')

      const preferences = await read_preferences({
        admission_vote_id,
        team_id: manager_team_id
      })
      expect(
        preferences.map((row) => row.admission_vote_candidate_id)
      ).to.deep.equal([candidate_ids.Alice])
    })

    it('refuses a transcription for a team absent from the snapshot', async () => {
      const { admission_vote_id, candidate_ids } = await seed_vote()

      const response = await transcribe_ballot({
        admission_vote_id,
        team_id: ineligible_team_id,
        ranked_candidate_ids: [candidate_ids.Alice],
        commissioner_entered_reason: 'sent by text'
      })

      response.should.have.status(403)
    })
  })
})
