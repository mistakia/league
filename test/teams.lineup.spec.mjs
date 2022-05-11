/* global describe before it beforeEach */
import chai from 'chai'
import chaiHTTP from 'chai-http'
import MockDate from 'mockdate'

import server from '#api'
import knex from '#db'
import league from '#db/seeds/league.mjs'
import { constants } from '#common'
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
chai.use(chaiHTTP)
const expect = chai.expect
const { start } = constants.season

describe('API /teams - lineups', function () {
  before(async function () {
    this.timeout(60 * 1000)
    await knex.migrate.forceFreeMigrationsLock()
    await knex.migrate.rollback()
    await knex.migrate.latest()
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

      const res = await chai
        .request(server)
        .put('/api/teams/1/lineups')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          players: [
            {
              player: player.player,
              slot: constants.slots.RB
            }
          ],
          leagueId
        })

      res.should.have.status(200)
      // eslint-disable-next-line
      res.should.be.json

      expect(res.body.length).to.equal(1)
      res.body[0].slot.should.equal(constants.slots.RB)
      res.body[0].player.should.equal(player.player)
      res.body[0].week.should.equal(constants.season.week)
      res.body[0].year.should.equal(constants.season.year)
      res.body[0].tid.should.equal(teamId)

      const rosterRows = await knex('rosters_players')
        .join('rosters', 'rosters_players.rid', 'rosters.uid')
        .where({
          player: player.player,
          tid: teamId,
          week: constants.season.week,
          year: constants.season.year
        })

      expect(rosterRows[0].slot).to.equal(constants.slots.RB)
      expect(rosterRows[0].player).to.equal(player.player)
      expect(rosterRows[0].pos).to.equal(player.pos1)
      expect(rosterRows[0].tid).to.equal(teamId)
      expect(rosterRows[0].lid).to.equal(leagueId)
      expect(rosterRows[0].week).to.equal(constants.season.week)
      expect(rosterRows[0].year).to.equal(constants.season.year)
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
      const request = chai.request(server).put('/api/teams/1/lineups')
      await notLoggedIn(request)
    })

    it('missing players', async () => {
      const request = chai
        .request(server)
        .put('/api/teams/1/lineups')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId: 1
        })

      await missing(request, 'players')
    })

    it('missing slot', async () => {
      const request = chai
        .request(server)
        .put('/api/teams/1/lineups')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          players: [
            {
              player: 'x'
            }
          ],
          leagueId: 1
        })

      await missing(request, 'slot')
    })

    it('missing player', async () => {
      const request = chai
        .request(server)
        .put('/api/teams/1/lineups')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId: 1,
          players: [
            {
              slot: constants.slots.RB
            }
          ]
        })

      await missing(request, 'player')
    })

    it('missing leagueId', async () => {
      const request = chai
        .request(server)
        .put('/api/teams/1/lineups')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          players: [
            {
              player: 'x',
              slot: constants.slots.RB
            }
          ]
        })

      await missing(request, 'leagueId')
    })

    it('invalid player - does not exist', async () => {
      const request = chai
        .request(server)
        .put('/api/teams/1/lineups')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId: 1,
          players: [
            {
              player: 'x',
              slot: constants.slots.RB
            }
          ]
        })

      await invalid(request, 'player')
    })

    it('teamId does not belong to userId', async () => {
      const request = chai
        .request(server)
        .put('/api/teams/1/lineups')
        .set('Authorization', `Bearer ${user2}`)
        .send({
          leagueId: 1,
          players: [
            {
              player: 'x',
              slot: constants.slots.RB
            }
          ]
        })

      await invalid(request, 'teamId')
    })

    it('player not eligible for slot', async () => {
      MockDate.set(start.add('1', 'month').toDate())
      const player = await selectPlayer({ pos: 'WR' })
      await addPlayer({
        leagueId: 1,
        teamId: 1,
        player,
        userId: 1
      })
      const request = chai
        .request(server)
        .put('/api/teams/1/lineups')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId: 1,
          players: [
            {
              player: player.player,
              slot: constants.slots.RB
            }
          ]
        })

      await invalid(request, 'slot')
    })

    it('player not on active roster', async () => {
      MockDate.set(start.add('1', 'month').toDate())
      const player = await selectPlayer({ pos: 'WR', rookie: true })
      await addPlayer({
        leagueId: 1,
        teamId: 1,
        player,
        userId: 1,
        slot: constants.slots.PS
      })
      const request = chai
        .request(server)
        .put('/api/teams/1/lineups')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId: 1,
          players: [
            {
              slot: constants.slots.RB,
              player: player.player
            }
          ]
        })

      await invalid(request, 'player')
    })

    it('player not on team', async () => {
      const player = await selectPlayer()
      const request = chai
        .request(server)
        .put('/api/teams/1/lineups')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId: 1,
          players: [
            {
              player: player.player,
              slot: constants.slots.RB
            }
          ]
        })

      await invalid(request, 'player')
    })

    it('previous lineup', async () => {
      MockDate.set(start.add('1', 'week').toDate())
      const player = await selectPlayer({ pos: 'WR' })
      await addPlayer({
        leagueId: 1,
        teamId: 1,
        player,
        userId: 1
      })

      MockDate.set(start.add('2', 'week').toDate())
      await addPlayer({
        leagueId: 1,
        teamId: 1,
        player,
        userId: 1
      })

      const request = chai
        .request(server)
        .put('/api/teams/1/lineups')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId: 1,
          players: [
            {
              player: player.player,
              slot: constants.slots.WR
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
      MockDate.set(start.subtract('1', 'week').toDate())
      const player = await selectPlayer({ pos: 'WR' })
      await addPlayer({
        leagueId: 1,
        teamId: 1,
        player,
        userId: 1,
        slot: constants.slots.IR
      })

      MockDate.set(start.add('6', 'week').toDate())
      await addPlayer({
        leagueId: 1,
        teamId: 1,
        player,
        userId: 1
      })

      const request = chai
        .request(server)
        .put('/api/teams/1/lineups')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId: 1,
          players: [
            {
              player: player.player,
              slot: constants.slots.WR
            }
          ],
          week: 6
        })

      await error(request, 'player ineligible to start during first six weeks')
    })
  })
})
