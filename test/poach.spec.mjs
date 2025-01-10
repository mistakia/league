/* global describe before it beforeEach */
import * as chai from 'chai'
import chai_http, { request as chai_request } from 'chai-http'
import MockDate from 'mockdate'

import server from '#api'
import knex from '#db'
import league from '#db/seeds/league.mjs'
import { constants } from '#libs-shared'
import { addPlayer, selectPlayer, error } from './utils/index.mjs'
import { user1 } from './fixtures/token.mjs'

process.env.NODE_ENV = 'test'
chai.use(chai_http)
const { start } = constants.season

describe('API /poaches', function () {
  before(async function () {
    this.timeout(60 * 1000)
    await knex.seed.run()
  })

  // claim for drafted
  // claim for added
  // claim for deactivated
  // claim for traded and deactivated

  describe('errors', function () {
    beforeEach(async function () {
      this.timeout(60 * 1000)
      MockDate.set(start.subtract('2', 'month').toISOString())
      await league(knex)
    })

    it('reserve player violation', async () => {
      MockDate.set(start.add('1', 'week').toISOString())
      const reservePlayer = await selectPlayer({
        nfl_status: constants.player_nfl_status.ACTIVE
      })
      const teamId = 1
      const leagueId = 1
      await addPlayer({
        leagueId,
        player: reservePlayer,
        teamId,
        slot: constants.slots.IR,
        userId: 1
      })

      const player = await selectPlayer({
        rookie: true,
        exclude_pids: [reservePlayer.pid]
      })
      await addPlayer({
        leagueId,
        player,
        teamId: 2,
        slot: constants.slots.PS,
        userId: 2
      })

      MockDate.set(start.add('1', 'week').add('3', 'day').toISOString())

      const request = chai_request
        .execute(server)
        .post('/api/leagues/1/poaches')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          teamId,
          pid: player.pid,
          leagueId
        })

      await error(request, 'Reserve player violation')
    })

    it('poach player after final week - locked', async () => {
      // TODO
    })

    it('santuary period - free agency period', async () => {
      // TODO
    })

    it('santuary period - regular season start', async () => {
      // TODO
    })

    it('santuary period - first 24 hours on practice squad', async () => {
      // TODO
    })

    it('protected player prior to extension deadline', async () => {
      // TODO
    })

    it('release player used in another poach', async () => {
      // TODO
    })
  })
  // errors

  // - not logged in
  // - invalid userId
  // - invalid leagueId
  // - invalid teamId
  // - invalid player
  // - invalid release
  // - teamId doesn't belong to userId
  // - release player not on team
  // - poaching claim with reserve violation

  // errors
  // - player on waivers - within 24 hours
  // - player has existing poaching claim
  // - player not on practice squad
  // - exceed roster space
  // - exceed available cap
})
