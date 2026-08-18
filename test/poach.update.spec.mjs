/* global describe before beforeEach it */
import * as chai from 'chai'
import chai_http, { request as chai_request } from 'chai-http'
import knex from '#db'
import MockDate from 'mockdate'

import server from '#api'
import league from '#db/fixtures/league.mjs'
import { current_season, roster_slot_types } from '#constants'
import { addPlayer, selectPlayer, error } from './utils/index.mjs'
import { user1 } from './fixtures/token.mjs'

process.env.NODE_ENV = 'test'
const { regular_season_start } = current_season
chai.use(chai_http)
const expect = chai.expect

describe('API /poaches - update', function () {
  before(async function () {
    this.timeout(60 * 1000)
    await knex.seed.run()
  })

  // The release check joins `poaches` to `poach_releases`, and both carry
  // `poach_id` since the key-column conform -- so an unqualified predicate there
  // is a 42702 that rejects the whole statement. It is reached before any roster
  // or salary check, so a spec that drives the route at all covers it; asserting
  // the refusal covers what the query RETURNS as well as that it executes.
  describe('put', function () {
    beforeEach(async function () {
      this.timeout(60 * 1000)
      MockDate.set(regular_season_start.subtract('2', 'month').toISOString())
      await league(knex)
    })

    it('release player used in another poach', async () => {
      const leagueId = 1
      const teamId = 1

      const poach_target = await selectPlayer({ rookie: true })
      await addPlayer({
        leagueId,
        player: poach_target,
        teamId: 2,
        userId: 2,
        slot: roster_slot_types.PS,
        value: 1
      })

      const release_player = await selectPlayer({
        exclude_pids: [poach_target.pid]
      })
      await addPlayer({
        leagueId,
        player: release_player,
        teamId,
        userId: 1,
        value: 1
      })

      const contested_player = await selectPlayer({
        exclude_pids: [poach_target.pid, release_player.pid]
      })
      await addPlayer({
        leagueId,
        player: contested_player,
        teamId,
        userId: 1,
        value: 1
      })

      const other_target = await selectPlayer({
        exclude_pids: [
          poach_target.pid,
          release_player.pid,
          contested_player.pid
        ]
      })

      const [poach] = await knex('poaches')
        .insert({
          pid: poach_target.pid,
          user_id: 1,
          tid: teamId,
          player_tid: 2,
          lid: leagueId,
          submitted: new Date()
        })
        .returning('poach_id')

      // A second poach, still pending, already claiming contested_player.
      const [other_poach] = await knex('poaches')
        .insert({
          pid: other_target.pid,
          user_id: 3,
          tid: 3,
          player_tid: 4,
          lid: leagueId,
          submitted: new Date()
        })
        .returning('poach_id')
      await knex('poach_releases').insert({
        poach_id: other_poach.poach_id,
        pid: contested_player.pid
      })

      const refused = chai_request
        .execute(server)
        .put(`/api/leagues/${leagueId}/poaches/${poach.poach_id}`)
        .set('Authorization', `Bearer ${user1}`)
        .send({ teamId, leagueId, release: [contested_player.pid] })

      await error(refused, 'release player used in another poach')

      const accepted = await chai_request
        .execute(server)
        .put(`/api/leagues/${leagueId}/poaches/${poach.poach_id}`)
        .set('Authorization', `Bearer ${user1}`)
        .send({ teamId, leagueId, release: [release_player.pid] })

      expect(accepted.status).to.equal(200)
      expect(accepted.body.release).to.eql([release_player.pid])

      const releases = await knex('poach_releases').where({
        poach_id: poach.poach_id
      })
      expect(releases.length).to.equal(1)
      expect(releases[0].pid).to.equal(release_player.pid)
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
  // - exceeds roster space
  // - exceeds salary space
})
