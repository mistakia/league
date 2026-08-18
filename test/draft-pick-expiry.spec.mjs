/* global describe before it after */
import * as chai from 'chai'
import chai_http, { request as chai_request } from 'chai-http'
import MockDate from 'mockdate'

import server from '#api'
import knex from '#db'
import league from '#db/fixtures/league.mjs'
import draft_picks from '#db/fixtures/draft-picks.mjs'
import { current_season } from '#constants'
import { close_rookie_draft, where_outstanding_draft_pick } from '#libs-server'
import { user1 } from './fixtures/token.mjs'

chai.use(chai_http)
const { regular_season_start } = current_season
const expect = chai.expect

// An unused pick expires at the close of its draft window per the 2023-09-03
// commissioner ruling. Before draft.expired_at existed, "outstanding" was
// inferred from `pid IS NULL` alone, which cannot tell a pick that is still
// owed a selection from one that will never get another -- so long-dead picks
// rendered as tradeable assets. These specs pin the distinction.
describe('draft pick expiry', function () {
  before(async function () {
    this.timeout(60 * 1000)

    MockDate.set(regular_season_start.subtract('1', 'month').toISOString())

    await knex.seed.run()
    await league(knex)
    await draft_picks(knex)
  })

  after(() => {
    MockDate.reset()
  })

  describe('close_rookie_draft', function () {
    it('expires unused picks and records the completion timestamp', async () => {
      const lid = 1
      const year = current_season.year
      // close_rookie_draft is Dates end to end: both seasons.rookie_draft_completed_at
      // and draft.expired_at are timestamptz.
      const completed_at = regular_season_start.subtract('1', 'week').toDate()

      const before_count = await knex('draft')
        .where({ lid, season_year: year })
        .modify(where_outstanding_draft_pick)
        .count('* as count')
        .first()

      expect(Number(before_count.count)).to.be.above(0)

      const { completed_at: recorded_at, expired_count } =
        await close_rookie_draft({
          lid,
          year,
          completed_at
        })

      expect(recorded_at.getTime()).to.equal(completed_at.getTime())
      expect(expired_count).to.equal(Number(before_count.count))

      const after_count = await knex('draft')
        .where({ lid, season_year: year })
        .modify(where_outstanding_draft_pick)
        .count('* as count')
        .first()

      expect(Number(after_count.count)).to.equal(0)

      const season = await knex('seasons')
        .where({ lid, season_year: year })
        .first()
      expect(season.rookie_draft_completed_at.getTime()).to.equal(
        completed_at.getTime()
      )
    })

    it('is idempotent and does not move the original timestamp', async () => {
      const lid = 1
      const year = current_season.year
      const later = regular_season_start.add('1', 'week').toDate()

      const { completed_at: recorded_at, expired_count } =
        await close_rookie_draft({
          lid,
          year,
          completed_at: later
        })

      // The league-year is already closed, so the supplied timestamp is
      // ignored rather than overwriting the recorded one.
      expect(recorded_at.getTime()).to.not.equal(later.getTime())
      expect(expired_count).to.equal(0)
    })

    it('refuses to close without a timestamp from either source', async () => {
      let caught
      try {
        await close_rookie_draft({ lid: 1, year: current_season.year + 1 })
      } catch (err) {
        caught = err
      }
      expect(caught).to.be.an('error')
      expect(caught.message).to.include('no completion timestamp')
    })
  })

  describe('expired picks are not assets', function () {
    it('omits them from the teams endpoint', async () => {
      const res = await chai_request
        .execute(server)
        .get('/api/leagues/1/teams')
        .set('Authorization', `Bearer ${user1}`)

      expect(res).to.have.status(200)

      const expired = await knex('draft')
        .where({ lid: 1 })
        .whereNotNull('expired_at')
        .select('draft_pick_id')
      const expired_uids = new Set(expired.map((p) => Number(p.draft_pick_id)))

      expect(expired_uids.size).to.be.above(0)

      for (const team of res.body.teams) {
        for (const pick of team.picks || []) {
          expect(expired_uids.has(Number(pick.draft_pick_id))).to.equal(
            false,
            `expired pick ${pick.draft_pick_id} returned as an asset of team ${team.team_id}`
          )
        }
      }
    })

    it('rejects a trade proposing one', async () => {
      // The route authorizes propose_tid against the caller before it reaches
      // pick validation, so the pick has to belong to user1's own team.
      const expired_pick = await knex('draft')
        .where({ lid: 1, tid: 1 })
        .whereNotNull('expired_at')
        .first()

      expect(expired_pick).to.exist

      const res = await chai_request
        .execute(server)
        .post('/api/leagues/1/trades')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          propose_tid: 1,
          accept_tid: 2,
          proposingTeamPicks: [expired_pick.draft_pick_id],
          acceptingTeamPlayers: [],
          proposingTeamPlayers: [],
          acceptingTeamPicks: [],
          releasePlayers: []
        })

      expect(res).to.have.status(400)
      expect(res.body.error).to.equal('pick is not valid')
    })
  })
})
