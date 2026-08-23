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

    it('rejects a protect one minute before the Regular Season begins', async () => {
      // Both legs are pinned to `openingDay`, whose date is checkable against
      // the NFL schedule. This case used to pin
      // `regular_season_start.add(1, 'week')` and assert the route's separate
      // 'practice squad protection is not yet open' error, which no season can
      // produce: `regular_season_start` is the Tuesday nine days before the
      // always-Thursday opener, so `+ 1 week` IS `openingDay - 2 days` -- the
      // constitutional Regular Season start AND the instant `isRegularSeason`
      // turns true. That guard was unreachable for its whole life and is gone;
      // `test/season.spec.mjs` now pins the identity the removal rests on.
      //
      // The old offset only landed anywhere meaningful while the 2026
      // `regular_season_start` was set a week early -- the same miscount that
      // unlinked every 2026 betting market from its game. Expressing a
      // boundary RELATIVE to the anchor under test is what hid both.
      const constitutional_start = current_season.openingDay.subtract(
        '2',
        'day'
      )

      MockDate.set(constitutional_start.subtract('1', 'minute').toISOString())

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

      // One minute later the same request succeeds. Without this leg the case
      // above passes for any clock the route rejects, including a boundary set
      // to the wrong week -- which is precisely how its predecessor stayed
      // green while asserting a state the code could not produce.
      //
      // Crossing the boundary moves `current_season.week` from 0 to 1, and a
      // roster is a snapshot of one (year, week), so the player has to be
      // seeded onto the week-1 roster too. That is what really happens to a
      // practice squad player held across the boundary, not a test artifact.
      MockDate.set(constitutional_start.toISOString())

      await addPlayer({
        leagueId: 1,
        player,
        teamId: 1,
        userId: 1,
        slot: roster_slot_types.PSD
      })

      const res = await chai_request
        .execute(server)
        .post('/api/teams/1/protect')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          pid: player.pid,
          leagueId: 1
        })

      res.should.have.status(200)
      res.body.pid.should.equal(player.pid)
      res.body.slot.should.equal(roster_slot_types.PSDP)

      MockDate.set(
        current_season.regular_season_start.add('1', 'month').toISOString()
      )
    })
  })
})
