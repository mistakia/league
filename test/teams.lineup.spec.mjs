/* global describe before it beforeEach */
import * as chai from 'chai'
import chai_http, { request as chai_request } from 'chai-http'
import MockDate from 'mockdate'

import server from '#api'
import knex from '#db'
import league from '#db/seeds/league.mjs'
import {
  current_season,
  roster_slot_types,
  transaction_types
} from '#constants'
import { user1, user2 } from './fixtures/token.mjs'
import {
  selectPlayer,
  addPlayer,
  invalid,
  missing,
  error,
  notLoggedIn
} from './utils/index.mjs'

process.env.NODE_ENV = 'test'

chai.should()
chai.use(chai_http)
const expect = chai.expect
const { regular_season_start } = current_season

describe('API /teams - lineups', function () {
  before(async function () {
    this.timeout(60 * 1000)
    await knex.seed.run()

    await league(knex)
  })

  describe('put', function () {
    it('current week', async () => {
      const leagueId = 1
      const teamId = 1
      const userId = 1
      const player = await selectPlayer({ pos: 'RB' })
      await addPlayer({
        leagueId,
        player,
        teamId,
        userId
      })

      const res = await chai_request
        .execute(server)
        .put('/api/teams/1/lineups')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          players: [
            {
              pid: player.pid,
              slot: roster_slot_types.RB
            }
          ],
          leagueId
        })

      res.should.have.status(200)

      res.should.be.json

      expect(res.body.length).to.equal(1)
      res.body[0].slot.should.equal(roster_slot_types.RB)
      res.body[0].pid.should.equal(player.pid)
      res.body[0].week.should.equal(current_season.week)
      res.body[0].year.should.equal(current_season.year)
      res.body[0].tid.should.equal(teamId)

      const rosterRows = await knex('rosters_players').where({
        pid: player.pid,
        tid: teamId,
        week: current_season.week,
        year: current_season.year
      })

      expect(rosterRows[0].slot).to.equal(roster_slot_types.RB)
      expect(rosterRows[0].pid).to.equal(player.pid)
      expect(rosterRows[0].pos).to.equal(player.pos1)
      expect(rosterRows[0].tid).to.equal(teamId)
      expect(rosterRows[0].lid).to.equal(leagueId)
      expect(rosterRows[0].week).to.equal(current_season.week)
      expect(rosterRows[0].year).to.equal(current_season.year)
    })

    it('future week', function () {
      // TODO
    })
  })

  describe('errors', function () {
    beforeEach(async function () {
      this.timeout(60 * 1000)
      await league(knex)
    })

    it('not logged in', async () => {
      const request = chai_request.execute(server).put('/api/teams/1/lineups')
      await notLoggedIn(request)
    })

    it('missing players', async () => {
      const request = chai_request
        .execute(server)
        .put('/api/teams/1/lineups')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId: 1
        })

      await missing(request, 'players')
    })

    it('missing slot', async () => {
      const request = chai_request
        .execute(server)
        .put('/api/teams/1/lineups')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          players: [
            {
              pid: 'x'
            }
          ],
          leagueId: 1
        })

      await missing(request, 'slot')
    })

    it('missing pid', async () => {
      const request = chai_request
        .execute(server)
        .put('/api/teams/1/lineups')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId: 1,
          players: [
            {
              slot: roster_slot_types.RB
            }
          ]
        })

      await missing(request, 'pid')
    })

    it('missing leagueId', async () => {
      const request = chai_request
        .execute(server)
        .put('/api/teams/1/lineups')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          players: [
            {
              pid: 'x',
              slot: roster_slot_types.RB
            }
          ]
        })

      await missing(request, 'leagueId')
    })

    it('invalid player - does not exist', async () => {
      const request = chai_request
        .execute(server)
        .put('/api/teams/1/lineups')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId: 1,
          players: [
            {
              pid: 'x',
              slot: roster_slot_types.RB
            }
          ]
        })

      await invalid(request, 'player')
    })

    it('teamId does not belong to userId', async () => {
      const request = chai_request
        .execute(server)
        .put('/api/teams/1/lineups')
        .set('Authorization', `Bearer ${user2}`)
        .send({
          leagueId: 1,
          players: [
            {
              pid: 'x',
              slot: roster_slot_types.RB
            }
          ]
        })

      await invalid(request, 'teamId')
    })

    it('player not eligible for slot', async () => {
      MockDate.set(regular_season_start.add('1', 'month').toISOString())
      const player = await selectPlayer({ pos: 'WR' })
      await addPlayer({
        leagueId: 1,
        teamId: 1,
        player,
        userId: 1
      })
      const request = chai_request
        .execute(server)
        .put('/api/teams/1/lineups')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId: 1,
          players: [
            {
              pid: player.pid,
              slot: roster_slot_types.RB
            }
          ]
        })

      await invalid(request, 'slot')
    })

    it('player not on active roster', async () => {
      MockDate.set(regular_season_start.add('1', 'month').toISOString())
      const player = await selectPlayer({ pos: 'WR', rookie: true })
      await addPlayer({
        leagueId: 1,
        teamId: 1,
        player,
        userId: 1,
        slot: roster_slot_types.PS
      })
      const request = chai_request
        .execute(server)
        .put('/api/teams/1/lineups')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId: 1,
          players: [
            {
              slot: roster_slot_types.RB,
              pid: player.pid
            }
          ]
        })

      await invalid(request, 'player')
    })

    it('player not on team', async () => {
      const player = await selectPlayer()
      const request = chai_request
        .execute(server)
        .put('/api/teams/1/lineups')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId: 1,
          players: [
            {
              pid: player.pid,
              slot: roster_slot_types.RB
            }
          ]
        })

      await invalid(request, 'player')
    })

    it('previous lineup', async () => {
      MockDate.set(regular_season_start.add('1', 'week').toISOString())
      const player = await selectPlayer({ pos: 'WR' })
      await addPlayer({
        leagueId: 1,
        teamId: 1,
        player,
        userId: 1
      })

      MockDate.set(regular_season_start.add('2', 'week').toISOString())
      await addPlayer({
        leagueId: 1,
        teamId: 1,
        player,
        userId: 1
      })

      const request = chai_request
        .execute(server)
        .put('/api/teams/1/lineups')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId: 1,
          players: [
            {
              pid: player.pid,
              slot: roster_slot_types.WR
            }
          ],
          week: 1
        })

      await error(request, 'lineup locked')
    })

    it('locked starter', async () => {
      // TODO
    })

    it('player started Regular Season on reserve', async () => {
      MockDate.set(regular_season_start.subtract('1', 'week').toISOString())
      const player = await selectPlayer({ pos: 'WR' })
      await addPlayer({
        leagueId: 1,
        teamId: 1,
        player,
        userId: 1,
        slot: roster_slot_types.RESERVE_SHORT_TERM,
        transaction: transaction_types.RESERVE_IR
      })

      await knex('seasons')
        .where({
          year: current_season.year,
          lid: 1
        })
        .update({
          free_agency_period_start: regular_season_start
            .subtract('6', 'days')
            .unix()
        })

      MockDate.set(regular_season_start.add('6', 'week').toISOString())
      await addPlayer({
        leagueId: 1,
        teamId: 1,
        player,
        userId: 1
      })

      const request = chai_request
        .execute(server)
        .put('/api/teams/1/lineups')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId: 1,
          players: [
            {
              pid: player.pid,
              slot: roster_slot_types.WR
            }
          ],
          week: 6
        })

      await error(request, 'player ineligible to start during first six weeks')
    })
  })
})
