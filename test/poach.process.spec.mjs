/* global describe before beforeEach it */
import chai from 'chai'
import chaiHTTP from 'chai-http'
import MockDate from 'mockdate'
import dirtyChai from 'dirty-chai'

import server from '#api'
import knex from '#db'
import { constants } from '#libs-shared'
import { user1 } from './fixtures/token.mjs'
import { addPlayer, selectPlayer } from './utils/index.mjs'
import league from '#db/seeds/league.mjs'

chai.should()
process.env.NODE_ENV = 'test'
chai.use(chaiHTTP)
chai.use(dirtyChai)
const expect = chai.expect
const { start } = constants.season

describe('API /poaches - process', function () {
  before(async function () {
    this.timeout(60 * 1000)
    await knex.migrate.forceFreeMigrationsLock()
    await knex.migrate.rollback()
    await knex.migrate.latest()
    await knex.seed.run()
  })

  describe('should process a poach', function () {
    beforeEach(async function () {
      this.timeout(60 * 1000)
      MockDate.set(start.subtract('2', 'month').toISOString())
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
        slot: constants.slots.PS,
        transaction: constants.transactions.PRACTICE_ADD,
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
      const res = await chai
        .request(server)
        .post(`/api/leagues/${leagueId}/poaches/${poach.uid}/process`)
        .set('Authorization', `Bearer ${user1}`)

      // Check response
      res.should.have.status(200)
      res.body.should.have.property('processed').not.null()

      // Check poaches table
      const updatedPoach = await knex('poaches').where('uid', poach.uid).first()
      updatedPoach.should.have.property('succ', 1)
      updatedPoach.should.have.property('processed').not.null()

      // Check rosters
      const poacherRoster = await knex('rosters_players')
        .where('tid', poach.tid)
        .andWhere('pid', poach.pid)
        .first()
      const poachedRoster = await knex('rosters_players')
        .where('tid', poach.player_tid)
        .andWhere('pid', poach.pid)
        .first()

      expect(poacherRoster).to.be.not.undefined()
      expect(poachedRoster).to.be.undefined()
    })
  })
})
