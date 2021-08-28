/* global describe before beforeEach it */
process.env.NODE_ENV = 'test'

const chai = require('chai')
const chaiHTTP = require('chai-http')
const MockDate = require('mockdate')

const knex = require('../db')

const league = require('../db/seeds/league')
const { constants, Errors } = require('../common')
const { start } = constants.season
const { selectPlayer, addPlayer } = require('./utils')

const run = require('../scripts/process-poaching-waivers')

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

  describe('process', function () {
    beforeEach(async function () {
      this.timeout(60 * 1000)
      MockDate.set(start.subtract('1', 'month').toDate())
      await league(knex)
    })

    it('no waivers to process - offseason', async () => {
      MockDate.set(start.subtract('1', 'month').toDate())

      let error
      try {
        await run()
      } catch (err) {
        error = err
      }

      // eslint-disable-next-line
      expect(error).to.exist
      expect(error).to.be.instanceof(Errors.EmptyPoachingWaivers)
      expect(error.message).to.equal('no poaching waivers to process')
    })

    it('no waivers to process - season', async () => {
      MockDate.set(start.add('1', 'month').toDate())

      let error
      try {
        await run()
      } catch (err) {
        error = err
      }

      // eslint-disable-next-line
      expect(error).to.exist
      expect(error).to.be.instanceof(Errors.EmptyPoachingWaivers)
    })

    it('no waivers ready to process - offseason', async () => {
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
        type: constants.waivers.POACH
      })

      let error
      try {
        await run()
      } catch (err) {
        error = err
      }

      expect(error).to.equal(undefined)

      const waivers = await knex('waivers')

      expect(waivers.length).to.equal(1)
      expect(waivers[0].player).to.equal(player.player)
      expect(waivers[0].succ).to.equal(null)
      expect(waivers[0].reason).to.equal(null)
      expect(waivers[0].processed).to.equal(null)
      expect(waivers[0].cancelled).to.equal(null)
    })

    it('no waivers ready to process - season', async () => {
      MockDate.set(start.add('1', 'month').day(5).toDate())

      const player = await selectPlayer({ rookie: true })
      await addPlayer({
        leagueId: 1,
        player,
        teamId: 1,
        userId: 1,
        slot: constants.slots.PS,
        transaction: constants.transactions.PRACTICE_ADD,
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
        type: constants.waivers.POACH
      })

      let error
      try {
        await run()
      } catch (err) {
        error = err
      }

      expect(error).to.equal(undefined)

      const waivers = await knex('waivers')

      expect(waivers.length).to.equal(1)
      expect(waivers[0].player).to.equal(player.player)
      expect(waivers[0].succ).to.equal(null)
      expect(waivers[0].reason).to.equal(null)
      expect(waivers[0].processed).to.equal(null)
      expect(waivers[0].cancelled).to.equal(null)
    })

    it('process single ready waiver - offseason', async () => {
      MockDate.set(start.subtract('1', 'month').day(5).toDate())

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
        type: constants.waivers.POACH
      })

      MockDate.set(
        start.subtract('1', 'month').day(6).add('1', 'minute').toDate()
      )

      let error
      try {
        await run()
      } catch (err) {
        error = err
      }

      expect(error).to.equal(undefined)

      // check waivers
      const waivers = await knex('waivers')
      expect(waivers.length).to.equal(1)
      expect(waivers[0].player).to.equal(player.player)
      expect(waivers[0].succ).to.equal(1)
      expect(waivers[0].reason).to.equal(null)
      expect(waivers[0].processed).to.equal(Math.round(Date.now() / 1000))
      expect(waivers[0].cancelled).to.equal(null)

      // check team waiver order
      const teams = await knex('teams').where({ lid: 1 })
      const team1 = teams.find((t) => t.uid === 1)
      const team2 = teams.find((t) => t.uid === 2)
      const team3 = teams.find((t) => t.uid === 3)
      const team4 = teams.find((t) => t.uid === 4)
      expect(team1.wo).to.equal(1)
      expect(team2.wo).to.equal(12)
      expect(team3.wo).to.equal(2)
      expect(team4.wo).to.equal(3)

      // verify poaching claim
      const poaches = await knex('poaches').where({ lid: 1 })
      expect(poaches.length).to.equal(1)
      expect(poaches[0].player).to.equal(player.player)
      expect(poaches[0].player_tid).to.equal(1)
      expect(poaches[0].userid).to.equal(2)
      expect(poaches[0].tid).to.equal(2)
      expect(poaches[0].lid).to.equal(1)
      expect(poaches[0].succ).to.equal(null)
      expect(poaches[0].submitted).to.equal(Math.round(Date.now() / 1000))
      expect(poaches[0].reason).to.equal(null)
      expect(poaches[0].processed).to.equal(null)
    })

    it('process single ready waiver - season', async () => {
      MockDate.set(start.add('1', 'month').day(5).toDate())

      const player = await selectPlayer({ rookie: true })
      await addPlayer({
        leagueId: 1,
        player,
        teamId: 1,
        userId: 1,
        slot: constants.slots.PS,
        transaction: constants.transactions.PRACTICE_ADD,
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
        type: constants.waivers.POACH
      })

      MockDate.set(start.add('1', 'month').day(6).add('1', 'minute').toDate())

      let error
      try {
        await run()
      } catch (err) {
        error = err
      }

      expect(error).to.equal(undefined)

      // check waivers
      const waivers = await knex('waivers')
      expect(waivers.length).to.equal(1)
      expect(waivers[0].player).to.equal(player.player)
      expect(waivers[0].succ).to.equal(1)
      expect(waivers[0].reason).to.equal(null)
      expect(waivers[0].processed).to.equal(Math.round(Date.now() / 1000))
      expect(waivers[0].cancelled).to.equal(null)

      // check team waiver order
      const teams = await knex('teams').where({ lid: 1 })
      const team1 = teams.find((t) => t.uid === 1)
      const team2 = teams.find((t) => t.uid === 2)
      const team3 = teams.find((t) => t.uid === 3)
      const team4 = teams.find((t) => t.uid === 4)
      expect(team1.wo).to.equal(1)
      expect(team2.wo).to.equal(12)
      expect(team3.wo).to.equal(2)
      expect(team4.wo).to.equal(3)

      // verify poaching claim
      const poaches = await knex('poaches').where({ lid: 1 })
      expect(poaches.length).to.equal(1)
      expect(poaches[0].player).to.equal(player.player)
      expect(poaches[0].player_tid).to.equal(1)
      expect(poaches[0].userid).to.equal(2)
      expect(poaches[0].tid).to.equal(2)
      expect(poaches[0].lid).to.equal(1)
      expect(poaches[0].succ).to.equal(null)
      expect(poaches[0].submitted).to.equal(Math.round(Date.now() / 1000))
      expect(poaches[0].reason).to.equal(null)
      expect(poaches[0].processed).to.equal(null)
    })

    it('process multiple waivers for the same player', async () => {
      MockDate.set(start.add('1', 'month').day(5).toDate())

      const player = await selectPlayer({ rookie: true })
      await addPlayer({
        leagueId: 1,
        player,
        teamId: 1,
        userId: 1,
        slot: constants.slots.PS,
        transaction: constants.transactions.PRACTICE_ADD,
        value: 1
      })

      // waiver one - user 2
      await knex('waivers').insert({
        tid: 2,
        userid: 2,
        lid: 1,
        player: player.player,
        po: 9999,
        submitted: Math.round(Date.now() / 1000),
        bid: 0,
        type: constants.waivers.POACH
      })

      // waiver two - user 4
      await knex('waivers').insert({
        tid: 4,
        userid: 4,
        lid: 1,
        player: player.player,
        po: 9999,
        submitted: Math.round(Date.now() / 1000),
        bid: 0,
        type: constants.waivers.POACH
      })

      MockDate.set(start.add('1', 'month').day(6).add('1', 'minute').toDate())

      let error
      try {
        await run()
      } catch (err) {
        error = err
      }

      expect(error).to.equal(undefined)

      // check waivers
      const waivers = await knex('waivers')
      const waiver1 = waivers.find((w) => w.tid === 2)
      const waiver2 = waivers.find((w) => w.tid === 4)
      expect(waivers.length).to.equal(2)
      expect(waiver1.player).to.equal(player.player)
      expect(waiver1.succ).to.equal(1)
      expect(waiver1.reason).to.equal(null)
      expect(waiver1.processed).to.equal(Math.round(Date.now() / 1000))
      expect(waiver1.cancelled).to.equal(null)

      expect(waiver2.player).to.equal(player.player)
      expect(waiver2.succ).to.equal(0)
      expect(waiver2.reason).to.equal('player has existing poaching claim')
      expect(waiver2.processed).to.equal(Math.round(Date.now() / 1000))
      expect(waiver2.cancelled).to.equal(null)

      // check team waiver order
      const teams = await knex('teams').where({ lid: 1 })
      const team1 = teams.find((t) => t.uid === 1)
      const team2 = teams.find((t) => t.uid === 2)
      const team3 = teams.find((t) => t.uid === 3)
      const team4 = teams.find((t) => t.uid === 4)
      expect(team1.wo).to.equal(1)
      expect(team2.wo).to.equal(12)
      expect(team3.wo).to.equal(2)
      expect(team4.wo).to.equal(3)

      // verify poaching claim
      const poaches = await knex('poaches').where({ lid: 1 })
      expect(poaches.length).to.equal(1)
      expect(poaches[0].player).to.equal(player.player)
      expect(poaches[0].player_tid).to.equal(1)
      expect(poaches[0].userid).to.equal(2)
      expect(poaches[0].tid).to.equal(2)
      expect(poaches[0].lid).to.equal(1)
      expect(poaches[0].succ).to.equal(null)
      expect(poaches[0].submitted).to.equal(Math.round(Date.now() / 1000))
      expect(poaches[0].reason).to.equal(null)
      expect(poaches[0].processed).to.equal(null)
    })

    it('process multiple waivers for multiple players', async () => {
      MockDate.set(start.add('1', 'month').day(5).toDate())

      const player1 = await selectPlayer({ rookie: true })
      await addPlayer({
        leagueId: 1,
        player: player1,
        teamId: 1,
        userId: 1,
        slot: constants.slots.PS,
        transaction: constants.transactions.PRACTICE_ADD,
        value: 1
      })

      const player2 = await selectPlayer({ rookie: true })
      await addPlayer({
        leagueId: 1,
        player: player2,
        teamId: 3,
        userId: 3,
        slot: constants.slots.PS,
        transaction: constants.transactions.PRACTICE_ADD,
        value: 1
      })

      // waiver one - user 2
      await knex('waivers').insert({
        tid: 2,
        userid: 2,
        lid: 1,
        player: player1.player,
        po: 9999,
        submitted: Math.round(Date.now() / 1000),
        bid: 0,
        type: constants.waivers.POACH
      })

      // waiver two - user 4
      await knex('waivers').insert({
        tid: 4,
        userid: 4,
        lid: 1,
        player: player2.player,
        po: 9999,
        submitted: Math.round(Date.now() / 1000),
        bid: 0,
        type: constants.waivers.POACH
      })

      MockDate.set(start.add('1', 'month').day(6).add('1', 'minute').toDate())

      let error
      try {
        await run()
      } catch (err) {
        error = err
      }

      expect(error).to.equal(undefined)

      // check waivers
      const waivers = await knex('waivers')
      const waiver1 = waivers.find((w) => w.tid === 2)
      const waiver2 = waivers.find((w) => w.tid === 4)
      expect(waivers.length).to.equal(2)
      expect(waiver1.player).to.equal(player1.player)
      expect(waiver1.succ).to.equal(1)
      expect(waiver1.reason).to.equal(null)
      expect(waiver1.processed).to.equal(Math.round(Date.now() / 1000))
      expect(waiver1.cancelled).to.equal(null)

      expect(waiver2.player).to.equal(player2.player)
      expect(waiver2.reason).to.equal(null)
      expect(waiver2.succ).to.equal(1)
      expect(waiver2.processed).to.equal(Math.round(Date.now() / 1000))
      expect(waiver2.cancelled).to.equal(null)

      // check team waiver order
      const teams = await knex('teams').where({ lid: 1 })
      const team1 = teams.find((t) => t.uid === 1)
      const team2 = teams.find((t) => t.uid === 2)
      const team3 = teams.find((t) => t.uid === 3)
      const team4 = teams.find((t) => t.uid === 4)
      expect(team1.wo).to.equal(1)
      expect(team2.wo).to.equal(11)
      expect(team3.wo).to.equal(2)
      expect(team4.wo).to.equal(12)

      // verify poaching claims
      const poaches = await knex('poaches').where({ lid: 1 })
      const poach1 = poaches.find((p) => p.tid === 2)
      const poach2 = poaches.find((p) => p.tid === 4)
      expect(poaches.length).to.equal(2)
      expect(poach1.player).to.equal(player1.player)
      expect(poach1.player_tid).to.equal(1)
      expect(poach1.userid).to.equal(2)
      expect(poach1.tid).to.equal(2)
      expect(poach1.lid).to.equal(1)
      expect(poach1.succ).to.equal(null)
      expect(poach1.submitted).to.equal(Math.round(Date.now() / 1000))
      expect(poach1.reason).to.equal(null)
      expect(poach1.processed).to.equal(null)

      expect(poach2.player).to.equal(player2.player)
      expect(poach2.player_tid).to.equal(3)
      expect(poach2.userid).to.equal(4)
      expect(poach2.tid).to.equal(4)
      expect(poach2.lid).to.equal(1)
      expect(poach2.succ).to.equal(null)
      expect(poach2.submitted).to.equal(Math.round(Date.now() / 1000))
      expect(poach2.reason).to.equal(null)
      expect(poach2.processed).to.equal(null)
    })

    it('process multiple waivers for the same and different players', async () => {
      MockDate.set(start.add('1', 'month').day(5).toDate())

      const player1 = await selectPlayer({ rookie: true })
      await addPlayer({
        leagueId: 1,
        player: player1,
        teamId: 1,
        userId: 1,
        slot: constants.slots.PS,
        transaction: constants.transactions.PRACTICE_ADD,
        value: 1
      })

      const player2 = await selectPlayer({ rookie: true })
      await addPlayer({
        leagueId: 1,
        player: player2,
        teamId: 3,
        userId: 3,
        slot: constants.slots.PS,
        transaction: constants.transactions.PRACTICE_ADD,
        value: 1
      })

      // waiver one - user 2
      await knex('waivers').insert({
        tid: 2,
        userid: 2,
        lid: 1,
        player: player1.player,
        po: 9999,
        submitted: Math.round(Date.now() / 1000),
        bid: 0,
        type: constants.waivers.POACH
      })

      // waiver two - user 4
      await knex('waivers').insert({
        tid: 4,
        userid: 4,
        lid: 1,
        player: player2.player,
        po: 9999,
        submitted: Math.round(Date.now() / 1000),
        bid: 0,
        type: constants.waivers.POACH
      })

      // waiver three - user 6
      await knex('waivers').insert({
        tid: 6,
        userid: 6,
        lid: 1,
        player: player1.player,
        po: 9999,
        submitted: Math.round(Date.now() / 1000),
        bid: 0,
        type: constants.waivers.POACH
      })

      MockDate.set(start.add('1', 'month').day(6).add('1', 'minute').toDate())

      let error
      try {
        await run()
      } catch (err) {
        error = err
      }

      expect(error).to.equal(undefined)

      // check waivers
      const waivers = await knex('waivers')
      const waiver1 = waivers.find((w) => w.tid === 2)
      const waiver2 = waivers.find((w) => w.tid === 4)
      const waiver3 = waivers.find((w) => w.tid === 6)
      expect(waivers.length).to.equal(3)
      expect(waiver1.player).to.equal(player1.player)
      expect(waiver1.succ).to.equal(1)
      expect(waiver1.reason).to.equal(null)
      expect(waiver1.processed).to.equal(Math.round(Date.now() / 1000))
      expect(waiver1.cancelled).to.equal(null)

      expect(waiver2.player).to.equal(player2.player)
      expect(waiver2.succ).to.equal(1)
      expect(waiver2.reason).to.equal(null)
      expect(waiver2.processed).to.equal(Math.round(Date.now() / 1000))
      expect(waiver2.cancelled).to.equal(null)

      expect(waiver3.player).to.equal(player1.player)
      expect(waiver3.succ).to.equal(0)
      expect(waiver3.reason).to.equal('player has existing poaching claim')
      expect(waiver3.processed).to.equal(Math.round(Date.now() / 1000))
      expect(waiver3.cancelled).to.equal(null)

      // check team waiver order
      const teams = await knex('teams').where({ lid: 1 })
      const team1 = teams.find((t) => t.uid === 1)
      const team2 = teams.find((t) => t.uid === 2)
      const team3 = teams.find((t) => t.uid === 3)
      const team4 = teams.find((t) => t.uid === 4)
      const team6 = teams.find((t) => t.uid === 6)
      expect(team1.wo).to.equal(1)
      expect(team2.wo).to.equal(11)
      expect(team3.wo).to.equal(2)
      expect(team4.wo).to.equal(12)
      expect(team6.wo).to.equal(4)

      // verify poaching claims
      const poaches = await knex('poaches').where({ lid: 1 })
      const poach1 = poaches.find((p) => p.tid === 2)
      const poach2 = poaches.find((p) => p.tid === 4)
      expect(poaches.length).to.equal(2)
      expect(poach1.player).to.equal(player1.player)
      expect(poach1.player_tid).to.equal(1)
      expect(poach1.userid).to.equal(2)
      expect(poach1.tid).to.equal(2)
      expect(poach1.lid).to.equal(1)
      expect(poach1.succ).to.equal(null)
      expect(poach1.submitted).to.equal(Math.round(Date.now() / 1000))
      expect(poach1.reason).to.equal(null)
      expect(poach1.processed).to.equal(null)

      expect(poach2.player).to.equal(player2.player)
      expect(poach2.player_tid).to.equal(3)
      expect(poach2.userid).to.equal(4)
      expect(poach2.tid).to.equal(4)
      expect(poach2.lid).to.equal(1)
      expect(poach2.succ).to.equal(null)
      expect(poach2.submitted).to.equal(Math.round(Date.now() / 1000))
      expect(poach2.reason).to.equal(null)
      expect(poach2.processed).to.equal(null)
    })
  })

  describe('errors', function () {
    beforeEach(async function () {
      this.timeout(60 * 1000)
      MockDate.set(start.subtract('1', 'month').toDate())
      await league(knex)
    })

    it('player not on practice squad', async () => {
      MockDate.set(start.add('1', 'month').day(5).toDate())

      const player = await selectPlayer({ rookie: true })
      await addPlayer({
        leagueId: 1,
        player,
        teamId: 1,
        userId: 1,
        slot: constants.slots.PS,
        transaction: constants.transactions.PRACTICE_ADD,
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
        type: constants.waivers.POACH
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

      MockDate.set(start.add('1', 'month').day(6).add('1', 'minute').toDate())

      let error
      try {
        await run()
      } catch (err) {
        error = err
      }

      expect(error).to.equal(undefined)

      // check waivers
      const waivers = await knex('waivers')
      expect(waivers.length).to.equal(1)
      expect(waivers[0].player).to.equal(player.player)
      expect(waivers[0].succ).to.equal(0)
      expect(waivers[0].reason).to.equal(
        'player is not in an unprotected practice squad slot'
      )
      expect(waivers[0].processed).to.equal(Math.round(Date.now() / 1000))
      expect(waivers[0].cancelled).to.equal(null)

      // check team waiver order
      const teams = await knex('teams').where({ lid: 1 })
      const team1 = teams.find((t) => t.uid === 1)
      const team2 = teams.find((t) => t.uid === 2)
      const team3 = teams.find((t) => t.uid === 3)
      const team4 = teams.find((t) => t.uid === 4)
      expect(team1.wo).to.equal(1)
      expect(team2.wo).to.equal(2)
      expect(team3.wo).to.equal(3)
      expect(team4.wo).to.equal(4)

      // verify poaching claim
      const poaches = await knex('poaches').where({ lid: 1 })
      expect(poaches.length).to.equal(0)
    })

    it('exceed roster limits', async () => {
      // TODO
    })

    it('exceed roster cap', async () => {
      // TODO
    })
  })
})
