/* global describe before beforeEach it */
process.env.NODE_ENV = 'test'

const chai = require('chai')
const MockDate = require('mockdate')
const knex = require('../db')

const league = require('../db/seeds/league')
const { constants, Errors } = require('../common')
const { start } = constants.season
const { selectPlayer, checkLastTransaction, checkRoster } = require('./utils')
const run = require('../scripts/process-waivers-free-agency-active')

chai.should()
const expect = chai.expect

describe('SCRIPTS /waivers - free agency - active roster', function () {
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

    it('process single faab waiver', async () => {
      MockDate.set(start.add('1', 'month').day(4).toDate())
      const player = await selectPlayer()
      const teamId = 1
      const leagueId = 1
      const value = 10
      await knex('waivers').insert({
        tid: teamId,
        userid: 1,
        lid: leagueId,
        player: player.player,
        po: 9999,
        submitted: Math.round(Date.now() / 1000),
        bid: value,
        type: constants.waivers.FREE_AGENCY
      })

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
      expect(team2.wo).to.equal(2)
      expect(team3.wo).to.equal(3)
      expect(team4.wo).to.equal(4)

      // verify roster
      await checkRoster({
        teamId,
        player: player.player,
        leagueId
      })

      // verify transaction
      await checkLastTransaction({
        leagueId,
        player: player.player,
        teamId,
        userId: 1,
        value,
        type: constants.transactions.ROSTER_ADD
      })

      // verify team faab budget
      expect(team1.faab).to.equal(200 - value)
    })

    it('process multiple faab waivers', async () => {
      MockDate.set(start.add('1', 'month').day(4).toDate())
      const leagueId = 1
      const player1 = await selectPlayer()
      const value1 = 180
      await knex('waivers').insert({
        tid: 1,
        userid: 1,
        lid: leagueId,
        player: player1.player,
        po: 9999,
        submitted: Math.round(Date.now() / 1000),
        bid: value1,
        type: constants.waivers.FREE_AGENCY
      })

      await knex('waivers').insert({
        tid: 2,
        userid: 1,
        lid: leagueId,
        player: player1.player,
        po: 9999,
        submitted: Math.round(Date.now() / 1000),
        bid: 80,
        type: constants.waivers.FREE_AGENCY
      })

      const player2 = await selectPlayer()
      const value2 = 80
      await knex('waivers').insert({
        tid: 2,
        userid: 1,
        lid: leagueId,
        player: player2.player,
        po: 9999,
        submitted: Math.round(Date.now() / 1000),
        bid: value2,
        type: constants.waivers.FREE_AGENCY
      })

      const player3 = await selectPlayer()
      const value3 = 20
      await knex('waivers').insert({
        tid: 1,
        userid: 1,
        lid: leagueId,
        player: player3.player,
        po: 9999,
        submitted: Math.round(Date.now() / 1000),
        bid: 30,
        type: constants.waivers.FREE_AGENCY
      })
      await knex('waivers').insert({
        tid: 2,
        userid: 1,
        lid: leagueId,
        player: player3.player,
        po: 9999,
        submitted: Math.round(Date.now() / 1000),
        bid: value3,
        type: constants.waivers.FREE_AGENCY
      })

      const player4 = await selectPlayer()
      const value4 = 2
      await knex('waivers').insert({
        tid: 1,
        userid: 1,
        lid: leagueId,
        player: player4.player,
        po: 9999,
        submitted: Math.round(Date.now() / 1000),
        bid: value4,
        type: constants.waivers.FREE_AGENCY
      })
      await knex('waivers').insert({
        tid: 4,
        userid: 1,
        lid: leagueId,
        player: player4.player,
        po: 9999,
        submitted: Math.round(Date.now() / 1000),
        bid: value4,
        type: constants.waivers.FREE_AGENCY
      })

      let error
      try {
        await run()
      } catch (err) {
        error = err
      }

      expect(error).to.equal(undefined)

      // check waivers
      const waivers = await knex('waivers').orderBy('uid')
      expect(waivers.length).to.equal(7)
      expect(waivers[0].player).to.equal(player1.player)
      expect(waivers[0].succ).to.equal(1)
      expect(waivers[0].reason).to.equal(null)
      expect(waivers[0].processed).to.equal(Math.round(Date.now() / 1000))
      expect(waivers[0].cancelled).to.equal(null)

      expect(waivers[1].succ).to.equal(0)
      expect(waivers[1].reason).to.equal('player is not a free agent')
      expect(waivers[1].player).to.equal(player1.player)

      expect(waivers[2].succ).to.equal(1)
      expect(waivers[2].reason).to.equal(null)
      expect(waivers[2].player).to.equal(player2.player)

      expect(waivers[3].succ).to.equal(0)
      expect(waivers[3].reason).to.equal(
        'exceeds available free agent auction budget'
      )
      expect(waivers[3].player).to.equal(player3.player)

      expect(waivers[4].succ).to.equal(1)
      expect(waivers[4].reason).to.equal(null)
      expect(waivers[4].player).to.equal(player3.player)

      expect(waivers[5].succ).to.equal(1)
      expect(waivers[5].reason).to.equal(null)
      expect(waivers[5].player).to.equal(player4.player)

      expect(waivers[6].succ).to.equal(0)
      expect(waivers[6].reason).to.equal('player is not a free agent')
      expect(waivers[6].player).to.equal(player4.player)

      // check team waiver order
      const teams = await knex('teams').where({ lid: 1 })
      const team1 = teams.find((t) => t.uid === 1)
      const team2 = teams.find((t) => t.uid === 2)
      const team3 = teams.find((t) => t.uid === 3)
      const team4 = teams.find((t) => t.uid === 4)
      expect(team1.wo).to.equal(12)
      expect(team2.wo).to.equal(1)
      expect(team3.wo).to.equal(2)
      expect(team4.wo).to.equal(3)

      // verify roster
      await checkRoster({
        teamId: 1,
        player: player1.player,
        leagueId
      })

      await checkRoster({
        teamId: 2,
        player: player2.player,
        leagueId
      })

      await checkRoster({
        teamId: 2,
        player: player3.player,
        leagueId
      })

      await checkRoster({
        teamId: 1,
        player: player4.player,
        leagueId
      })

      // verify transactions
      const transactions = await knex('transactions')
        .where('lid', leagueId)
        .orderBy('uid')
      expect(transactions.length).to.equal(4)
      expect(transactions[0].player).to.equal(player1.player)
      expect(transactions[0].tid).to.equal(1)
      expect(transactions[0].value).to.equal(value1)
      expect(transactions[0].type).to.equal(constants.transactions.ROSTER_ADD)

      expect(transactions[1].player).to.equal(player2.player)
      expect(transactions[1].tid).to.equal(2)
      expect(transactions[1].value).to.equal(value2)
      expect(transactions[1].type).to.equal(constants.transactions.ROSTER_ADD)

      expect(transactions[2].player).to.equal(player3.player)
      expect(transactions[2].tid).to.equal(2)
      expect(transactions[2].value).to.equal(value3)
      expect(transactions[2].type).to.equal(constants.transactions.ROSTER_ADD)

      expect(transactions[3].player).to.equal(player4.player)
      expect(transactions[3].tid).to.equal(1)
      expect(transactions[3].value).to.equal(value4)
      expect(transactions[3].type).to.equal(constants.transactions.ROSTER_ADD)
    })

    it('no waivers ready to process', async () => {
      MockDate.set(start.add('1', 'month').day(4).toDate())
      const player = await selectPlayer()
      const leagueId = 1
      await knex('transactions').insert({
        userid: 2,
        tid: 2,
        lid: leagueId,
        player: player.player,
        type: constants.transactions.ROSTER_RELEASE,
        value: 0,
        year: constants.season.year,
        timestamp: Math.round(Date.now() / 1000)
      })

      const teamId = 1
      const value = 10
      await knex('waivers').insert({
        tid: teamId,
        userid: 1,
        lid: leagueId,
        player: player.player,
        po: 9999,
        submitted: Math.round(Date.now() / 1000),
        bid: value,
        type: constants.waivers.FREE_AGENCY
      })

      let error
      try {
        await run()
      } catch (err) {
        error = err
      }

      expect(error).to.equal(undefined)

      const waivers = await knex('waivers').orderBy('uid')
      expect(waivers.length).to.equal(1)
      expect(waivers[0].player).to.equal(player.player)
      expect(waivers[0].succ).to.equal(null)
      expect(waivers[0].reason).to.equal(null)
      expect(waivers[0].processed).to.equal(null)
      expect(waivers[0].cancelled).to.equal(null)
    })
  })

  describe('errors', function () {
    beforeEach(async function () {
      this.timeout(60 * 1000)
      MockDate.set(start.subtract('1', 'month').toDate())
      await league(knex)
    })

    it('outside regular season', async () => {
      let error
      try {
        await run()
      } catch (err) {
        error = err
      }

      expect(error).to.be.instanceof(Errors.NotRegularSeason)
      expect(error.message).to.equal('not regular season')
    })

    it('no waivers to process', async () => {
      MockDate.set(start.add('1', 'month').day(4).toDate())
      let error
      try {
        await run()
      } catch (err) {
        error = err
      }

      expect(error).to.be.instanceof(Errors.EmptyFreeAgencyWaivers)
      expect(error.message).to.equal('no free agency waivers to process')
    })

    it('release player not on team', async () => {
      // TODO
    })

    it('exceeds roster limits', async () => {
      // TODO
    })

    it('exceeds faab', async () => {
      // TODO
    })
  })
})
