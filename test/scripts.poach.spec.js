/* global describe before beforeEach it */
process.env.NODE_ENV = 'test'

const chai = require('chai')
const chaiHTTP = require('chai-http')
const MockDate = require('mockdate')

const knex = require('../db')

const league = require('../db/seeds/league')
const { constants } = require('../common')
const { getRoster } = require('../utils')
const { start } = constants.season
const { addPlayer, selectPlayer } = require('./utils')

const run = require('../scripts/process-poaching-claims')

chai.should()
chai.use(chaiHTTP)
const expect = chai.expect

describe('SCRIPTS /waivers - poach', function () {
  before(async function () {
    this.timeout(60 * 1000)
    await knex.migrate.forceFreeMigrationsLock()
    await knex.migrate.rollback()
    await knex.migrate.latest()
    await knex.seed.run()
  })

  describe('run', function () {
    beforeEach(async function () {
      this.timeout(60 * 1000)
      MockDate.set(start.subtract('1', 'month').toDate())
      await league(knex)
    })

    it('process single claim', async () => {
      MockDate.set(start.subtract('1', 'month').toDate())
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
        player: player.player,
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
        player: player.player,
        submitted: Math.round(Date.now() / 1000)
      })

      MockDate.set(
        start.subtract('1', 'month').add('2', 'day').add('1', 'minute').toDate()
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
      expect(rosterRow2.players[0].player).to.equal(player.player)
      expect(rosterRow2.players[0].slot).to.equal(constants.slots.BENCH)
      expect(rosterRow2.players[0].type).to.equal(
        constants.transactions.POACHED
      )
      expect(rosterRow2.players[0].value).to.equal(3)

      // check poaching claim
      const poaches = await knex('poaches')
      expect(poaches.length).to.equal(1)
      expect(poaches[0].succ).to.equal(1)
      expect(poaches[0].processed).to.equal(Math.round(Date.now() / 1000))
      expect(poaches[0].reason).to.equal(null)
      expect(poaches[0].player).to.equal(player.player)
    })

    it('process single claim, of multiple', async () => {
      MockDate.set(start.subtract('1', 'month').toDate())
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
        player: player1.player,
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
        player: player1.player,
        submitted: Math.round(Date.now() / 1000)
      })

      MockDate.set(start.subtract('1', 'month').add('2', 'hour').toDate())
      const player2 = await selectPlayer({ rookie: true })
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
        player: player2.player,
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
        player: player2.player,
        submitted: Math.round(Date.now() / 1000)
      })

      MockDate.set(
        start.subtract('1', 'month').add('2', 'day').add('1', 'minute').toDate()
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
      expect(rosterRow2.players[0].player).to.equal(player1.player)
      expect(rosterRow2.players[0].slot).to.equal(constants.slots.BENCH)
      expect(rosterRow2.players[0].type).to.equal(
        constants.transactions.POACHED
      )
      expect(rosterRow2.players[0].value).to.equal(3)

      expect(rosterRow3.tid).to.equal(3)
      expect(rosterRow3.players.length).to.equal(1)
      expect(rosterRow3.players[0].player).to.equal(player2.player)
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
      expect(poach1.succ).to.equal(1)
      expect(poach1.processed).to.equal(Math.round(Date.now() / 1000))
      expect(poach1.reason).to.equal(null)
      expect(poach1.player).to.equal(player1.player)

      expect(poach2.succ).to.equal(null)
      expect(poach2.processed).to.equal(null)
      expect(poach2.reason).to.equal(null)
      expect(poach2.player).to.equal(player2.player)
    })

    it('no claims to be processed', async () => {
      MockDate.set(start.subtract('1', 'month').toDate())
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
        player: player.player,
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
        player: player.player,
        submitted: Math.round(Date.now() / 1000)
      })

      let error
      try {
        await run()
      } catch (err) {
        error = err
      }

      // eslint-disable-next-line
      expect(error).to.exist
      expect(error.message).to.equal('no claims to process')

      // check rosters
      const rosterRow1 = await getRoster({ tid: 1 })
      const rosterRow2 = await getRoster({ tid: 2 })

      expect(rosterRow1.tid).to.equal(1)
      expect(rosterRow1.players.length).to.equal(1)
      expect(rosterRow1.players[0].player).to.equal(player.player)
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
      expect(poaches[0].player).to.equal(player.player)
    })

    it('release player not on roster - have roster space', async () => {
      MockDate.set(start.subtract('1', 'month').toDate())
      const releasePlayer = await selectPlayer({ pos: 'RB' })
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

      const query1 = await knex('waivers').insert({
        tid: 2,
        userid: 2,
        lid: 1,
        player: player.player,
        po: 9999,
        submitted: Math.round(Date.now() / 1000),
        bid: 0,
        succ: 1,
        processed: Math.round(Date.now() / 1000),
        type: constants.waivers.POACH
      })

      await knex('waiver_releases').insert({
        waiverid: query1[0],
        player: releasePlayer.player
      })

      const query2 = await knex('poaches').insert({
        userid: 2,
        tid: 2,
        lid: 1,
        player: player.player,
        submitted: Math.round(Date.now() / 1000)
      })

      await knex('poach_releases').insert({
        poachid: query2[0],
        player: releasePlayer.player
      })

      MockDate.set(
        start.subtract('1', 'month').add('2', 'day').add('1', 'minute').toDate()
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
      expect(rosterRow2.players[0].player).to.equal(player.player)
      expect(rosterRow2.players[0].slot).to.equal(constants.slots.BENCH)
      expect(rosterRow2.players[0].type).to.equal(
        constants.transactions.POACHED
      )
      expect(rosterRow2.players[0].value).to.equal(3)

      // check poaching claim
      const poaches = await knex('poaches')
      expect(poaches.length).to.equal(1)
      expect(poaches[0].succ).to.equal(1)
      expect(poaches[0].processed).to.equal(Math.round(Date.now() / 1000))
      expect(poaches[0].reason).to.equal(null)
      expect(poaches[0].player).to.equal(player.player)
    })
  })

  describe('errors', function () {
    beforeEach(async function () {
      this.timeout(60 * 1000)
      MockDate.set(start.subtract('1', 'month').toDate())
      await league(knex)
    })

    it('player is not on a practice squad', async () => {
      MockDate.set(start.subtract('1', 'month').toDate())
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
        player: player.player,
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
        player: player.player,
        submitted: Math.round(Date.now() / 1000)
      })

      await knex('rosters_players')
        .update({ slot: constants.slots.BENCH })
        .where({ player: player.player })

      await knex('transactions').insert({
        userid: 1,
        tid: 1,
        lid: 1,
        player: player.player,
        type: constants.transactions.ROSTER_ACTIVATE,
        value: 1,
        year: constants.season.year,
        timestamp: Math.round(Date.now() / 1000)
      })

      MockDate.set(
        start.subtract('1', 'month').add('2', 'day').add('1', 'minute').toDate()
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
      expect(rosterRow1.players[0].player).to.equal(player.player)
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
      expect(poaches[0].succ).to.equal(0)
      expect(poaches[0].processed).to.equal(Math.round(Date.now() / 1000))
      expect(poaches[0].reason).to.equal('player is not on a practice squad')
      expect(poaches[0].player).to.equal(player.player)
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
