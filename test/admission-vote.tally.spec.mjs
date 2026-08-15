/* global describe before beforeEach it after */
import * as chai from 'chai'
import MockDate from 'mockdate'

import knex from '#db'
import league from '#db/fixtures/league.mjs'
import users from '#db/fixtures/users.mjs'
import { current_season } from '#constants'
import calculate_admission_vote_points from '#libs-server/calculate-admission-vote-points.mjs'
import close_admission_vote from '#libs-server/close-admission-vote.mjs'
import get_admission_vote_totals from '#libs-server/get-admission-vote-totals.mjs'
import {
  admission_vote_statuses,
  admission_vote_decision_period_days
} from '#libs-shared/constants/admission-vote-constants.mjs'

const expect = chai.expect

const league_id = 1

// The league fixture seats teams 1..12. A vote here uses a subset of them as
// its eligibility snapshot, which is what a real one does -- Section 10(c)
// strikes the vacant Team.
const eligible_team_ids = [1, 2, 3, 4]

const open_vote = async ({ maximum_ranked_candidates = 3 } = {}) => {
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

  return { admission_vote_id, opened_at, closes_at }
}

const add_candidate = async ({ admission_vote_id, candidate_name }) => {
  const [{ admission_vote_candidate_id }] = await knex(
    'admission_vote_candidates'
  )
    .insert({ admission_vote_id, candidate_name })
    .returning('admission_vote_candidate_id')

  return admission_vote_candidate_id
}

// Ranked candidate ids in preference order: first element is preference_rank 1.
const cast_ballot = async ({
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

describe('ADMISSION VOTE TALLY', function () {
  describe('calculate_admission_vote_points', function () {
    it('scores a full ballot down from the stated maximum', function () {
      const points = calculate_admission_vote_points({
        preferences: [
          { admission_vote_candidate_id: 10, preference_rank: 1 },
          { admission_vote_candidate_id: 20, preference_rank: 2 },
          { admission_vote_candidate_id: 30, preference_rank: 3 }
        ],
        maximum_ranked_candidates: 3
      })

      expect(points.get(10)).to.equal(3)
      expect(points.get(20)).to.equal(2)
      expect(points.get(30)).to.equal(1)
    })

    // Section 10(b) pegs points to the stated maximum, never to ballot length.
    // A Team that ranks two must not give its favourite less weight than a Team
    // that ranks six, which is the whole reason the maximum comes off the vote
    // row rather than off the rows in hand.
    it('gives a short ballot its first preference the full stated maximum', function () {
      const short_ballot = calculate_admission_vote_points({
        preferences: [
          { admission_vote_candidate_id: 10, preference_rank: 1 },
          { admission_vote_candidate_id: 20, preference_rank: 2 }
        ],
        maximum_ranked_candidates: 6
      })

      const full_ballot = calculate_admission_vote_points({
        preferences: [
          { admission_vote_candidate_id: 10, preference_rank: 1 },
          { admission_vote_candidate_id: 20, preference_rank: 2 },
          { admission_vote_candidate_id: 30, preference_rank: 3 },
          { admission_vote_candidate_id: 40, preference_rank: 4 },
          { admission_vote_candidate_id: 50, preference_rank: 5 },
          { admission_vote_candidate_id: 60, preference_rank: 6 }
        ],
        maximum_ranked_candidates: 6
      })

      expect(short_ballot.get(10)).to.equal(6)
      expect(short_ballot.get(10)).to.equal(full_ballot.get(10))
    })

    // "A Candidate whom a Team ... ranks below the number stated in that
    // Notice, receives no points from that Team."
    it('scores a preference beyond the stated maximum at nothing', function () {
      const points = calculate_admission_vote_points({
        preferences: [
          { admission_vote_candidate_id: 10, preference_rank: 1 },
          { admission_vote_candidate_id: 20, preference_rank: 2 },
          { admission_vote_candidate_id: 30, preference_rank: 3 }
        ],
        maximum_ranked_candidates: 2
      })

      expect(points.get(10)).to.equal(2)
      expect(points.get(20)).to.equal(1)
      // present at zero rather than absent -- Section 10(e) discloses a figure
      // for each Candidate, and a missing key is not a figure
      expect(points.get(30)).to.equal(0)
    })

    it('reports an entirely unranked candidate at zero', function () {
      const points = calculate_admission_vote_points({
        preferences: [{ admission_vote_candidate_id: 10, preference_rank: 1 }],
        maximum_ranked_candidates: 2,
        admission_vote_candidate_ids: [10, 20, 30]
      })

      expect(points.get(10)).to.equal(2)
      expect(points.get(20)).to.equal(0)
      expect(points.get(30)).to.equal(0)
    })

    // Section 10's floor. A stated maximum of zero would score every Candidate
    // at zero and hand the whole ranking to the Commissioner.
    it('refuses a stated maximum below one', function () {
      expect(() =>
        calculate_admission_vote_points({
          preferences: [],
          maximum_ranked_candidates: 0
        })
      ).to.throw(/at least 1/)
    })
  })

  describe('close and disclose', function () {
    before(async function () {
      this.timeout(60 * 1000)
      MockDate.set(current_season.regular_season_start.toISOString())
      await knex.seed.run()
      await users(knex)
      await league(knex)
    })

    beforeEach(async function () {
      await knex('admission_vote_ballot_preferences').del()
      await knex('admission_vote_ballots').del()
      await knex('admission_vote_candidates').del()
      await knex('admission_vote_eligible_teams').del()
      await knex('admission_votes').del()
    })

    after(async () => {
      await knex('admission_vote_ballot_preferences').del()
      await knex('admission_vote_ballots').del()
      await knex('admission_vote_candidates').del()
      await knex('admission_vote_eligible_teams').del()
      await knex('admission_votes').del()
      MockDate.reset()
    })

    // The sealing property, executed rather than argued. Nothing in the totals
    // function consults who is asking, so this holds for the Commissioner too.
    it('discloses nothing at all while the vote is open', async () => {
      const { admission_vote_id } = await open_vote()
      const alice = await add_candidate({
        admission_vote_id,
        candidate_name: 'Alice'
      })
      const bob = await add_candidate({
        admission_vote_id,
        candidate_name: 'Bob'
      })

      await cast_ballot({
        admission_vote_id,
        team_id: 1,
        ranked_candidate_ids: [alice, bob]
      })
      await cast_ballot({
        admission_vote_id,
        team_id: 2,
        ranked_candidate_ids: [alice]
      })

      const totals = await get_admission_vote_totals({ admission_vote_id })
      expect(totals).to.deep.equal([])
    })

    it('returns nothing for a vote that does not exist', async () => {
      const totals = await get_admission_vote_totals({
        admission_vote_id: 999999
      })
      expect(totals).to.deep.equal([])
    })

    it('pins a point total for every candidate at close', async () => {
      const { admission_vote_id } = await open_vote({
        maximum_ranked_candidates: 3
      })
      const alice = await add_candidate({
        admission_vote_id,
        candidate_name: 'Alice'
      })
      const bob = await add_candidate({
        admission_vote_id,
        candidate_name: 'Bob'
      })
      const carol = await add_candidate({
        admission_vote_id,
        candidate_name: 'Carol'
      })

      // Alice 3+3 = 6, Bob 2+1 = 3, Carol 2
      await cast_ballot({
        admission_vote_id,
        team_id: 1,
        ranked_candidate_ids: [alice, bob]
      })
      await cast_ballot({
        admission_vote_id,
        team_id: 2,
        ranked_candidate_ids: [alice, carol, bob]
      })

      await close_admission_vote({ admission_vote_id })

      const totals = await get_admission_vote_totals({ admission_vote_id })

      expect(
        totals.map((row) => [row.candidate_name, row.points_total])
      ).to.deep.equal([
        ['Alice', 6],
        ['Bob', 3],
        ['Carol', 2]
      ])
      expect(totals[0].admission_vote_candidate_id).to.equal(alice)
    })

    // Section 10(e) discloses the points recorded for each Candidate and
    // nothing else. The response shape is the enforcement: a per-Team key here
    // would be the disclosure the section forbids.
    it('carries no per-team field in the disclosed rows', async () => {
      const { admission_vote_id } = await open_vote()
      const alice = await add_candidate({
        admission_vote_id,
        candidate_name: 'Alice'
      })

      await cast_ballot({
        admission_vote_id,
        team_id: 3,
        ranked_candidate_ids: [alice]
      })

      await close_admission_vote({ admission_vote_id })

      const totals = await get_admission_vote_totals({ admission_vote_id })
      expect(totals).to.have.length(1)
      expect(Object.keys(totals[0]).sort()).to.deep.equal([
        'admission_vote_candidate_id',
        'candidate_name',
        'points_total'
      ])
    })

    it('starts the seven-day decision clock from the close', async () => {
      const { admission_vote_id } = await open_vote()
      await add_candidate({ admission_vote_id, candidate_name: 'Alice' })

      const closed_at = new Date()
      const result = await close_admission_vote({
        admission_vote_id,
        closed_at
      })

      const vote = await knex('admission_votes')
        .where({ admission_vote_id })
        .first()

      expect(vote.vote_status).to.equal(admission_vote_statuses.CLOSED)
      expect(vote.closed_at.getTime()).to.equal(closed_at.getTime())
      expect(vote.decision_due_at.getTime()).to.equal(
        closed_at.getTime() +
          admission_vote_decision_period_days * 24 * 60 * 60 * 1000
      )
      expect(vote.decision_outcome).to.equal(null)
      expect(result.decision_due_at.getTime()).to.equal(
        vote.decision_due_at.getTime()
      )
    })

    // Recomputing the totals or moving the deadline is exactly the
    // history-rewriting that pinning them exists to prevent.
    it('refuses to close a vote that is already closed', async () => {
      const { admission_vote_id } = await open_vote()
      await add_candidate({ admission_vote_id, candidate_name: 'Alice' })
      await close_admission_vote({ admission_vote_id })

      let error
      try {
        await close_admission_vote({ admission_vote_id })
      } catch (caught) {
        error = caught
      }

      expect(error).to.exist
      expect(error.message).to.match(/already closed/)
    })

    it('refuses to close a vote that does not exist', async () => {
      let error
      try {
        await close_admission_vote({ admission_vote_id: 999999 })
      } catch (caught) {
        error = caught
      }

      expect(error).to.exist
      expect(error.message).to.match(/does not exist/)
    })
  })
})
