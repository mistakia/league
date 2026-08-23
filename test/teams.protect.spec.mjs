/* global describe before it */
import * as chai from 'chai'
import chai_http, { request as chai_request } from 'chai-http'
import MockDate from 'mockdate'

import server from '#api'
import knex from '#db'

import league from '#db/fixtures/league.mjs'
import { current_season, roster_slot_types } from '#constants'
import { user1, user2 } from './fixtures/token.mjs'
import {
  addPlayer,
  selectPlayer,
  notLoggedIn,
  missing,
  invalid,
  error
} from './utils/index.mjs'

process.env.NODE_ENV = 'test'

chai.should()
chai.use(chai_http)

describe('API /teams - protect', function () {
  before(async function () {
    this.timeout(60 * 1000)
    await knex.seed.run()

    MockDate.set(
      current_season.regular_season_start.add('1', 'month').toISOString()
    )
  })

  describe('post', function () {
    before(async function () {
      this.timeout(60 * 1000)
      await league(knex)
    })

    it('rookie practice squad player', async () => {
      // TODO
    })

    it('veteran free agent practice squad player', async () => {
      // TODO
    })
  })

  describe('errors', function () {
    it('not logged in', async () => {
      const request = chai_request.execute(server).post('/api/teams/1/protect')
      await notLoggedIn(request)
    })

    it('missing pid', async () => {
      const request = chai_request
        .execute(server)
        .post('/api/teams/1/protect')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId: 1
        })

      await missing(request, 'pid')
    })

    it('missing leagueId', async () => {
      const request = chai_request
        .execute(server)
        .post('/api/teams/1/protect')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          pid: 'x'
        })

      await missing(request, 'leagueId')
    })

    it('teamId does not belong to userId', async () => {
      const request = chai_request
        .execute(server)
        .post('/api/teams/1/protect')
        .set('Authorization', `Bearer ${user2}`)
        .send({
          leagueId: 1,
          pid: 'x'
        })

      await invalid(request, 'teamId')
    })

    it('player not on team', async () => {
      const player = await selectPlayer()
      const request = chai_request
        .execute(server)
        .post('/api/teams/1/protect')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId: 1,
          pid: player.pid
        })

      await invalid(request, 'player')
    })

    it('player already protected on practice squad', async () => {
      const player = await selectPlayer({ rookie: true })
      await addPlayer({
        leagueId: 1,
        player,
        teamId: 1,
        userId: 1,
        slot: roster_slot_types.PSP
      })
      const request = chai_request
        .execute(server)
        .post('/api/teams/1/protect')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          pid: player.pid,
          leagueId: 1
        })

      await error(request, 'player is already protected')
    })

    it('player has a poaching claim', async () => {
      // TODO
    })

    it('during the off-season', async () => {
      // TODO
    })

    it('rejects a protect one minute before the Article XIV window opens', async () => {
      // This used to pin `regular_season_start.add(1, 'week')` and describe it
      // as "the regular season has started but it is before the first Tuesday
      // of Week 1", asserting the route's 'practice squad protection is not
      // yet open' error. No such window exists. `regular_season_start` is the
      // Tuesday nine days before the always-Thursday opener and
      // practice_squad_protection_start is the Tuesday two days before it, so
      // `regular_season_start + 1 week` IS the instant protection opens -- and
      // it is the same instant `isRegularSeason` turns true, for every season,
      // since both reduce to `openingDay - 2 days`. The route checks
      // isRegularSeason FIRST, so its Article XIV branch is unreachable and
      // this boundary is guarded by the offseason error instead.
      //
      // The old offset only landed inside a gap while the 2026
      // `regular_season_start` was set a week early -- the same miscount that
      // unlinked every 2026 betting market from its game. In both cases
      // expressing a boundary RELATIVE to the anchor is what hid it, so this
      // pins the boundary itself.
      MockDate.set(
        current_season.practice_squad_protection_start
          .subtract('1', 'minute')
          .toISOString()
      )

      const player = await selectPlayer({ rookie: true })
      await addPlayer({
        leagueId: 1,
        player,
        teamId: 1,
        userId: 1,
        slot: roster_slot_types.PSD
      })
      const request = chai_request
        .execute(server)
        .post('/api/teams/1/protect')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          pid: player.pid,
          leagueId: 1
        })

      await error(request, 'not permitted during the offseason')

      MockDate.set(
        current_season.regular_season_start.add('1', 'month').toISOString()
      )
    })
  })
})
