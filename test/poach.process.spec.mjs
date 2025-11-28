/* global describe before beforeEach it */
import * as chai from 'chai'
import chai_http, { request as chai_request } from 'chai-http'
import MockDate from 'mockdate'

import server from '#api'
import knex from '#db'
import {
  roster_slot_types,
  transaction_types,
  current_season
} from '#constants'
import { user1 } from './fixtures/token.mjs'
import { addPlayer, selectPlayer } from './utils/index.mjs'
import league from '#db/seeds/league.mjs'

chai.should()
process.env.NODE_ENV = 'test'
chai.use(chai_http)
const expect = chai.expect
const { regular_season_start } = current_season

describe('API /poaches - process', function () {
  before(async function () {
    this.timeout(60 * 1000)
    await knex.seed.run()
  })

  describe('should process a poach', function () {
    beforeEach(async function () {
      this.timeout(60 * 1000)
      MockDate.set(regular_season_start.subtract('2', 'month').toISOString())
      await league(knex)
    })

    it('should process a poach', async () => {
      const player1 = await selectPlayer()
      const teamId = 1
      const leagueId = 1
      const userId = 1
      await addPlayer({
        teamId,
        leagueId,
        userId,
        player: player1,
        slot: roster_slot_types.PS,
        transaction: transaction_types.PRACTICE_ADD,
        value: 0
      })

      // Create a poaching claim
      const poach = {
        uid: 1,
        pid: player1.pid,
        userid: 2,
        tid: 2,
        player_tid: teamId,
        lid: leagueId,
        succ: null,
        submitted: Math.round(Date.now() / 1000),
        reason: null,
        processed: null
      }
      await knex('poaches').insert(poach)

      // Process the poach
      const res = await chai_request
        .execute(server)
        .post(`/api/leagues/${leagueId}/poaches/${poach.uid}/process`)
        .set('Authorization', `Bearer ${user1}`)

      // Check response
      expect(res.status).to.equal(200)
      expect(res.body.processed).to.not.equal(null)

      // Check poaches table
      const updatedPoach = await knex('poaches').where('uid', poach.uid).first()
      expect(updatedPoach.succ).to.equal(true)
      expect(updatedPoach.processed).to.not.equal(null)

      // Check rosters
      const poacherRoster = await knex('rosters_players')
        .where('tid', poach.tid)
        .andWhere('pid', poach.pid)
        .first()
      const poachedRoster = await knex('rosters_players')
        .where('tid', poach.player_tid)
        .andWhere('pid', poach.pid)
        .first()

      expect(poacherRoster).to.not.equal(undefined)
      expect(poachedRoster).to.equal(undefined)
    })
  })
})
