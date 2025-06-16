/* global describe before beforeEach it */
import * as chai from 'chai'
// import chai_http, { request as chai_request } from 'chai-http'
import MockDate from 'mockdate'

import knex from '#db'
import league from '#db/seeds/league.mjs'
import { constants, Errors } from '#libs-shared'
import { getRoster } from '#libs-server'
import { addPlayer, selectPlayer } from './utils/index.mjs'
import run from '#scripts/process-poaching-claims.mjs'

process.env.NODE_ENV = 'test'

chai.should()
// chai.use(chai_http)
const expect = chai.expect
const { regular_season_start } = constants.season

describe('SCRIPTS /waivers - poach', function () {
  before(async function () {
    this.timeout(60 * 1000)

    MockDate.set(regular_season_start.subtract('1', 'month').toISOString())

    await knex.seed.run()
  })

  describe('run', function () {
    beforeEach(async function () {
      this.timeout(60 * 1000)
      MockDate.set(regular_season_start.subtract('1', 'month').toISOString())
      await league(knex)
    })

    it('process single claim', async () => {
      MockDate.set(regular_season_start.subtract('1', 'month').toISOString())
      const player = await selectPlayer({ rookie: true })
      await addPlayer({
        leagueId: 1,
        player,
        teamId: 1,
        userId: 1,
        slot: constants.slots.PS,
        transaction: constants.transactions.DRAFT,
        value: 1
      })

      await knex('waivers').insert({
        tid: 2,
        userid: 2,
        lid: 1,
        pid: player.pid,
        po: 9999,
        submitted: Math.round(Date.now() / 1000),
        bid: 0,
        succ: 1,
        processed: Math.round(Date.now() / 1000),
        type: constants.waivers.POACH
      })

      await knex('poaches').insert({
        userid: 2,
        tid: 2,
        lid: 1,
        pid: player.pid,
        player_tid: 1,
        submitted: Math.round(Date.now() / 1000)
      })

      MockDate.set(
        regular_season_start
          .subtract('1', 'month')
          .add('2', 'day')
          .add('1', 'minute')
          .toISOString()
      )

      let error
      try {
        await run()
      } catch (err) {
        error = err
      }

      expect(error).to.equal(undefined)

      // check rosters
      const rosterRow1 = await getRoster({ tid: 1 })
      const rosterRow2 = await getRoster({ tid: 2 })

      expect(rosterRow1.tid).to.equal(1)
      expect(rosterRow1.players.length).to.equal(0)

      expect(rosterRow2.tid).to.equal(2)
      expect(rosterRow2.players.length).to.equal(1)
      expect(rosterRow2.players[0].pid).to.equal(player.pid)
      expect(rosterRow2.players[0].slot).to.equal(constants.slots.BENCH)
      expect(rosterRow2.players[0].type).to.equal(
        constants.transactions.POACHED
      )
      expect(rosterRow2.players[0].value).to.equal(3)

      // check poaching claim
      const poaches = await knex('poaches')
      expect(poaches.length).to.equal(1)
      expect(poaches[0].succ).to.equal(true)
      expect(poaches[0].processed).to.equal(Math.round(Date.now() / 1000))
      expect(poaches[0].reason).to.equal(null)
      expect(poaches[0].pid).to.equal(player.pid)

      // check conditional pick
      const draft = await knex('draft')
      expect(draft.length).to.equal(1)
      expect(draft[0].round).to.equal(4)
      expect(draft[0].tid).to.equal(1)
      expect(draft[0].otid).to.equal(1)
      expect(draft[0].year).to.equal(constants.season.year + 1)
    })

    it('process single claim, of multiple', async () => {
      MockDate.set(regular_season_start.subtract('1', 'month').toISOString())
      const player1 = await selectPlayer({ rookie: true })
      await addPlayer({
        leagueId: 1,
        player: player1,
        teamId: 1,
        userId: 1,
        slot: constants.slots.PS,
        transaction: constants.transactions.DRAFT,
        value: 1
      })

      await knex('waivers').insert({
        tid: 2,
        userid: 2,
        lid: 1,
        pid: player1.pid,
        po: 9999,
        submitted: Math.round(Date.now() / 1000),
        bid: 0,
        succ: 1,
        processed: Math.round(Date.now() / 1000),
        type: constants.waivers.POACH
      })

      await knex('poaches').insert({
        userid: 2,
        tid: 2,
        lid: 1,
        pid: player1.pid,
        player_tid: 1,
        submitted: Math.round(Date.now() / 1000)
      })

      MockDate.set(
        regular_season_start
          .subtract('1', 'month')
          .add('2', 'hour')
          .toISOString()
      )
      const player2 = await selectPlayer({
        rookie: true,
        exclude_pids: [player1.pid]
      })
      await addPlayer({
        leagueId: 1,
        player: player2,
        teamId: 3,
        userId: 3,
        slot: constants.slots.PS,
        transaction: constants.transactions.DRAFT,
        value: 1
      })

      await knex('waivers').insert({
        tid: 4,
        userid: 4,
        lid: 1,
        pid: player2.pid,
        po: 9999,
        submitted: Math.round(Date.now() / 1000),
        bid: 0,
        succ: 1,
        processed: Math.round(Date.now() / 1000),
        type: constants.waivers.POACH
      })

      await knex('poaches').insert({
        userid: 4,
        tid: 4,
        lid: 1,
        pid: player2.pid,
        player_tid: 3,
        submitted: Math.round(Date.now() / 1000)
      })

      MockDate.set(
        regular_season_start
          .subtract('1', 'month')
          .add('2', 'day')
          .add('1', 'minute')
          .toISOString()
      )

      let error
      try {
        await run()
      } catch (err) {
        error = err
      }

      expect(error).to.equal(undefined)

      // check rosters
      const rosterRow1 = await getRoster({ tid: 1 })
      const rosterRow2 = await getRoster({ tid: 2 })
      const rosterRow3 = await getRoster({ tid: 3 })
      const rosterRow4 = await getRoster({ tid: 4 })

      expect(rosterRow1.tid).to.equal(1)
      expect(rosterRow1.players.length).to.equal(0)

      expect(rosterRow2.tid).to.equal(2)
      expect(rosterRow2.players.length).to.equal(1)
      expect(rosterRow2.players[0].pid).to.equal(player1.pid)
      expect(rosterRow2.players[0].slot).to.equal(constants.slots.BENCH)
      expect(rosterRow2.players[0].type).to.equal(
        constants.transactions.POACHED
      )
      expect(rosterRow2.players[0].value).to.equal(3)

      expect(rosterRow3.tid).to.equal(3)
      expect(rosterRow3.players.length).to.equal(1)
      expect(rosterRow3.players[0].pid).to.equal(player2.pid)
      expect(rosterRow3.players[0].slot).to.equal(constants.slots.PS)
      expect(rosterRow3.players[0].type).to.equal(constants.transactions.DRAFT)
      expect(rosterRow3.players[0].value).to.equal(1)

      expect(rosterRow4.tid).to.equal(4)
      expect(rosterRow4.players.length).to.equal(0)

      // check poaching claim
      const poaches = await knex('poaches')
      const poach1 = poaches.find((p) => p.tid === 2)
      const poach2 = poaches.find((p) => p.tid === 4)
      expect(poaches.length).to.equal(2)
      expect(poach1.succ).to.equal(true)
      expect(poach1.processed).to.equal(Math.round(Date.now() / 1000))
      expect(poach1.reason).to.equal(null)
      expect(poach1.pid).to.equal(player1.pid)

      expect(poach2.succ).to.equal(null)
      expect(poach2.processed).to.equal(null)
      expect(poach2.reason).to.equal(null)
      expect(poach2.pid).to.equal(player2.pid)
    })

    it('no claims to be processed', async () => {
      MockDate.set(regular_season_start.subtract('1', 'month').toISOString())
      const player = await selectPlayer({ rookie: true })
      await addPlayer({
        leagueId: 1,
        player,
        teamId: 1,
        userId: 1,
        slot: constants.slots.PS,
        transaction: constants.transactions.DRAFT,
        value: 1
      })

      await knex('waivers').insert({
        tid: 2,
        userid: 2,
        lid: 1,
        pid: player.pid,
        po: 9999,
        submitted: Math.round(Date.now() / 1000),
        bid: 0,
        succ: 1,
        processed: Math.round(Date.now() / 1000),
        type: constants.waivers.POACH
      })

      await knex('poaches').insert({
        userid: 2,
        tid: 2,
        lid: 1,
        pid: player.pid,
        player_tid: 1,
        submitted: Math.round(Date.now() / 1000)
      })

      let error
      try {
        await run()
      } catch (err) {
        error = err
      }

      expect(error).to.exist
      expect(error).to.be.instanceof(Errors.EmptyPoachingClaims)
      expect(error.message).to.equal('no poaching claims to process')

      // check rosters
      const rosterRow1 = await getRoster({ tid: 1 })
      const rosterRow2 = await getRoster({ tid: 2 })

      expect(rosterRow1.tid).to.equal(1)
      expect(rosterRow1.players.length).to.equal(1)
      expect(rosterRow1.players[0].pid).to.equal(player.pid)
      expect(rosterRow1.players[0].slot).to.equal(constants.slots.PS)
      expect(rosterRow1.players[0].type).to.equal(constants.transactions.DRAFT)
      expect(rosterRow1.players[0].value).to.equal(1)

      expect(rosterRow2.tid).to.equal(2)
      expect(rosterRow2.players.length).to.equal(0)

      // check poaching claim
      const poaches = await knex('poaches')
      expect(poaches.length).to.equal(1)
      expect(poaches[0].succ).to.equal(null)
      expect(poaches[0].processed).to.equal(null)
      expect(poaches[0].reason).to.equal(null)
      expect(poaches[0].pid).to.equal(player.pid)

      // check conditional pick
      const draft = await knex('draft')
      expect(draft.length).to.equal(0)
    })

    it('release player not on roster - have roster space', async () => {
      MockDate.set(regular_season_start.subtract('1', 'month').toISOString())
      const releasePlayer = await selectPlayer({ pos: 'RB' })
      const player = await selectPlayer({
        rookie: true,
        exclude_pids: [releasePlayer.pid]
      })
      await addPlayer({
        leagueId: 1,
        player,
        teamId: 1,
        userId: 1,
        slot: constants.slots.PS,
        transaction: constants.transactions.DRAFT,
        value: 1
      })

      const query1 = await knex('waivers')
        .insert({
          tid: 2,
          userid: 2,
          lid: 1,
          pid: player.pid,
          po: 9999,
          submitted: Math.round(Date.now() / 1000),
          bid: 0,
          succ: 1,
          processed: Math.round(Date.now() / 1000),
          type: constants.waivers.POACH
        })
        .returning('uid')

      await knex('waiver_releases').insert({
        waiverid: query1[0].uid,
        pid: releasePlayer.pid
      })

      const query2 = await knex('poaches')
        .insert({
          userid: 2,
          tid: 2,
          lid: 1,
          pid: player.pid,
          player_tid: 1,
          submitted: Math.round(Date.now() / 1000)
        })
        .returning('uid')

      await knex('poach_releases').insert({
        poachid: query2[0].uid,
        pid: releasePlayer.pid
      })

      MockDate.set(
        regular_season_start
          .subtract('1', 'month')
          .add('2', 'day')
          .add('1', 'minute')
          .toISOString()
      )

      let error
      try {
        await run()
      } catch (err) {
        error = err
      }

      expect(error).to.equal(undefined)

      // check rosters
      const rosterRow1 = await getRoster({ tid: 1 })
      const rosterRow2 = await getRoster({ tid: 2 })

      expect(rosterRow1.tid).to.equal(1)
      expect(rosterRow1.players.length).to.equal(0)

      expect(rosterRow2.tid).to.equal(2)
      expect(rosterRow2.players.length).to.equal(1)
      expect(rosterRow2.players[0].pid).to.equal(player.pid)
      expect(rosterRow2.players[0].slot).to.equal(constants.slots.BENCH)
      expect(rosterRow2.players[0].type).to.equal(
        constants.transactions.POACHED
      )
      expect(rosterRow2.players[0].value).to.equal(3)

      // check poaching claim
      const poaches = await knex('poaches')
      expect(poaches.length).to.equal(1)
      expect(poaches[0].succ).to.equal(true)
      expect(poaches[0].processed).to.equal(Math.round(Date.now() / 1000))
      expect(poaches[0].reason).to.equal(null)
      expect(poaches[0].pid).to.equal(player.pid)
    })
  })

  describe('errors', function () {
    beforeEach(async function () {
      this.timeout(60 * 1000)
      MockDate.set(regular_season_start.subtract('1', 'month').toISOString())
      await league(knex)
    })

    it('player is not on a practice squad', async () => {
      MockDate.set(regular_season_start.subtract('1', 'month').toISOString())
      const player = await selectPlayer({ rookie: true })
      await addPlayer({
        leagueId: 1,
        player,
        teamId: 1,
        userId: 1,
        slot: constants.slots.PS,
        transaction: constants.transactions.DRAFT,
        value: 1
      })

      await knex('waivers').insert({
        tid: 2,
        userid: 2,
        lid: 1,
        pid: player.pid,
        po: 9999,
        submitted: Math.round(Date.now() / 1000),
        bid: 0,
        succ: 1,
        processed: Math.round(Date.now() / 1000),
        type: constants.waivers.POACH
      })

      await knex('poaches').insert({
        userid: 2,
        tid: 2,
        lid: 1,
        pid: player.pid,
        player_tid: 1,
        submitted: Math.round(Date.now() / 1000)
      })

      await knex('rosters_players')
        .update({ slot: constants.slots.BENCH })
        .where({ pid: player.pid })

      await knex('transactions').insert({
        userid: 1,
        tid: 1,
        lid: 1,
        pid: player.pid,
        type: constants.transactions.ROSTER_ACTIVATE,
        value: 1,
        week: constants.season.week,
        year: constants.season.year,
        timestamp: Math.round(Date.now() / 1000)
      })

      MockDate.set(
        regular_season_start
          .subtract('1', 'month')
          .add('2', 'day')
          .add('1', 'minute')
          .toISOString()
      )

      let error
      try {
        await run()
      } catch (err) {
        error = err
      }

      expect(error).to.equal(undefined)

      // check rosters
      const rosterRow1 = await getRoster({ tid: 1 })
      const rosterRow2 = await getRoster({ tid: 2 })

      expect(rosterRow1.tid).to.equal(1)
      expect(rosterRow1.players.length).to.equal(1)
      expect(rosterRow1.players[0].pid).to.equal(player.pid)
      expect(rosterRow1.players[0].slot).to.equal(constants.slots.BENCH)
      expect(rosterRow1.players[0].type).to.equal(
        constants.transactions.ROSTER_ACTIVATE
      )
      expect(rosterRow1.players[0].value).to.equal(1)

      expect(rosterRow2.tid).to.equal(2)
      expect(rosterRow2.players.length).to.equal(0)

      // check poaching claim
      const poaches = await knex('poaches')
      expect(poaches.length).to.equal(1)
      expect(poaches[0].succ).to.equal(false)
      expect(poaches[0].processed).to.equal(Math.round(Date.now() / 1000))
      expect(poaches[0].reason).to.equal('player is not on a practice squad')
      expect(poaches[0].pid).to.equal(player.pid)
    })

    it('exceeds roster limits', async () => {
      // TODO
    })

    it('exceeds available cap', async () => {
      // TODO
    })

    it('release player not on roster & exceeds roster limits', async () => {
      // TODO
    })
  })
})
