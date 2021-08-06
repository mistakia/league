/* global describe before beforeEach it */
process.env.NODE_ENV = 'test'

const chai = require('chai')
const MockDate = require('mockdate')
const knex = require('../db')

const league = require('../db/seeds/league')
const { constants } = require('../common')
const { getLeague } = require('../utils')
const { start } = constants.season
const { selectPlayer, checkLastTransaction, checkRoster } = require('./utils')

const run = require('../scripts/process-waivers-free-agency-practice')

chai.should()
const expect = chai.expect

describe('SCRIPTS /waivers - free agency - practice', function () {
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
      MockDate.set(start.subtract('2', 'month').toDate())
      await league(knex)
    })

    it('rookie post draft single waiver - offseason', async () => {
      const leagueId = 1
      const league = await getLeague(leagueId)
      const days = league.nteams * 3 + 1
      MockDate.set(start.subtract('2', 'month').add(days, 'day').toDate())

      const player = await selectPlayer({ rookie: true })
      const teamId = 1
      await knex('waivers').insert({
        tid: teamId,
        userid: 1,
        lid: leagueId,
        player: player.player,
        po: 9999,
        submitted: Math.round(Date.now() / 1000),
        bid: 0,
        type: constants.waivers.FREE_AGENCY_PRACTICE
      })

      let error
      try {
        await run()
      } catch (err) {
        console.log(err)
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
      expect(team1.wo).to.equal(12)
      expect(team2.wo).to.equal(1)
      expect(team3.wo).to.equal(2)
      expect(team4.wo).to.equal(3)

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
        value: 0,
        type: constants.transactions.PRACTICE_ADD
      })

      expect(team1.faab).to.equal(200)
    })

    it('rookie post draft multiple waivers - offseason', async () => {
      // TODO
    })

    it('rookie post draft multiple separate waivers - offseason', async () => {
      // TODO
    })

    it('rookie release waivers, single waiver - offseason', async () => {
      // TODO
    })

    it('rookie release waivers - season', async () => {
      // TODO
    })

    it('rookie release waivers, multiple waivers - season', async () => {
      // TODO
    })

    it('no waivers ready to process - offseason', async () => {
      const leagueId = 1
      const league = await getLeague(leagueId)
      const days = league.nteams * 3
      MockDate.set(
        start.subtract('2', 'month').add(days, 'day').add('1', 'hour').toDate()
      )

      const player = await selectPlayer({ rookie: true })
      const teamId = 1
      await knex('waivers').insert({
        tid: teamId,
        userid: 1,
        lid: leagueId,
        player: player.player,
        po: 9999,
        submitted: Math.round(Date.now() / 1000),
        bid: 0,
        type: constants.waivers.FREE_AGENCY_PRACTICE
      })

      let error
      try {
        await run()
      } catch (err) {
        console.log(err)
        error = err
      }

      expect(error).to.equal(undefined)

      // check waivers
      const waivers = await knex('waivers')
      expect(waivers.length).to.equal(1)
      expect(waivers[0].player).to.equal(player.player)
      expect(waivers[0].succ).to.equal(null)
      expect(waivers[0].reason).to.equal(null)
      expect(waivers[0].processed).to.equal(null)
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

      expect(team1.faab).to.equal(200)
    })
  })

  describe('errors', function () {
    beforeEach(async function () {
      this.timeout(60 * 1000)
      MockDate.set(start.subtract('1', 'month').toDate())
      await league(knex)
    })

    it('no waivers to process', async () => {
      MockDate.set(start.add('1', 'month').day(4).toDate())
      let error
      try {
        await run()
      } catch (err) {
        error = err
      }

      expect(error.message).to.equal('no waivers to process')
    })

    it('no waivers ready to be processed - regular season waiver period', async () => {
      // TODO
    })

    it('release player not on team', async () => {
      // TODO
    })

    it('exceeds roster limits', async () => {
      // TODO
    })

    it('active roster waiver exists for player', async () => {
      // TODO
    })
  })
})
