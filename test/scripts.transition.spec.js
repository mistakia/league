/* global describe before beforeEach it */
process.env.NODE_ENV = 'test'

const chai = require('chai')
const MockDate = require('mockdate')
const knex = require('../db')

const league = require('../db/seeds/league')
const { constants, Roster } = require('../common')
const { start } = constants.season
const { getLeague, getRoster } = require('../utils')
const {
  selectPlayer,
  checkLastTransaction,
  checkRoster,
  addPlayer,
  fillRoster
} = require('./utils')

const run = require('../scripts/process-transition-bids')

chai.should()
const expect = chai.expect

describe('SCRIPTS - transition bids - restricted free agency', function () {
  before(async function () {
    this.timeout(60 * 1000)
    await knex.migrate.forceFreeMigrationsLock()
    await knex.migrate.rollback()
    await knex.migrate.latest()
    await knex.seed.run()
  })

  describe('process', function () {
    const leagueId = 1

    beforeEach(async function () {
      this.timeout(60 * 1000)
      await league(knex)
      const tranDate = start.subtract('1', 'month').unix()
      await knex('seasons').insert({
        lid: leagueId,
        year: constants.season.year,
        tran_date: tranDate
      })
      MockDate.set(start.subtract('1', 'month').toDate())
    })

    it('process single bid', async () => {
      const player = await selectPlayer()
      const teamId = 1
      const value = 10
      const userId = 1

      await addPlayer({
        leagueId,
        player,
        teamId,
        userId
      })

      const timestamp = Math.round(Date.now() / 1000)
      await knex('transition_bids').insert({
        player: player.player,
        userid: userId,
        bid: value,
        tid: teamId,
        year: constants.season.year,
        player_tid: teamId,
        lid: leagueId,
        submitted: timestamp
      })

      let error
      try {
        await run()
      } catch (err) {
        error = err
      }

      expect(error).to.equal(undefined)

      // check transition bid
      const transitionBids = await knex('transition_bids')
      expect(transitionBids.length).to.equal(1)
      expect(transitionBids[0].succ).to.equal(1)
      expect(transitionBids[0].processed).to.equal(timestamp)
      expect(transitionBids[0].reason).to.equal(null)

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
        type: constants.transactions.TRANSITION_TAG
      })
    })

    it('process single bid with cutlist and conditional release', async () => {
      // TODO - make sure selected players are unique
      const player1 = await selectPlayer() // 30 - rfa
      const player2 = await selectPlayer() // 20 - cutlist
      const player3 = await selectPlayer() // 20 - cutlist
      const player4 = await selectPlayer() // 20 - release
      const player5 = await selectPlayer() // 160 - high salary retained
      const teamId = 1
      const userId = 1
      const bid = 30

      const players = [player1, player2, player3, player4]
      for (const player of players) {
        await addPlayer({
          leagueId,
          player,
          teamId,
          userId,
          value: 20
        })
      }

      await addPlayer({
        leagueId,
        player: player5,
        teamId,
        userId,
        value: 160
      })

      await fillRoster({ leagueId, teamId, excludeIR: true })

      const timestamp = Math.round(Date.now() / 1000)
      const query1 = await knex('transition_bids').insert({
        player: player1.player,
        userid: userId,
        bid,
        tid: teamId,
        year: constants.season.year,
        player_tid: teamId,
        lid: leagueId,
        submitted: timestamp
      })

      await knex('transition_releases').insert({
        transitionid: query1[0],
        player: player4.player
      })

      const cutlist = [player2, player3].map((p, idx) => ({
        player: p.player,
        order: idx,
        tid: teamId
      }))
      await knex('cutlist').insert(cutlist)

      let error
      try {
        await run()
      } catch (err) {
        error = err
      }

      expect(error).to.equal(undefined)

      // check transition bid
      const transitionBids = await knex('transition_bids')
      expect(transitionBids.length).to.equal(1)
      expect(transitionBids[0].succ).to.equal(1)
      expect(transitionBids[0].processed).to.equal(timestamp)
      expect(transitionBids[0].reason).to.equal(null)

      // verify roster
      await checkRoster({
        teamId,
        player: player1.player,
        leagueId
      })

      // verify transaction
      await checkLastTransaction({
        leagueId,
        player: player1.player,
        teamId,
        userId: 1,
        value: bid,
        type: constants.transactions.TRANSITION_TAG
      })

      // verify released players
      const league = await getLeague(leagueId)
      const rosterRow = await getRoster({ tid: teamId })
      const roster = new Roster({ roster: rosterRow, league })

      expect(roster.has(player2.player)).to.equal(false)
      expect(roster.has(player3.player)).to.equal(false)
      expect(roster.has(player4.player)).to.equal(false)

      // verify cutlist
      const transactions = await knex('transactions').where({ lid: leagueId })
      const releaseTransactions = transactions.filter(
        (t) => t.type === constants.transactions.ROSTER_RELEASE
      )
      expect(releaseTransactions.length).to.equal(3)
    })

    it('process multiple bids', async () => {
      // TODO
    })

    it('process tied bids among original team', async () => {
      // TODO
    })
  })

  describe('errors', function () {
    beforeEach(async function () {
      this.timeout(60 * 1000)
      MockDate.set(start.subtract('1', 'month').toDate())
      await league(knex)
    })

    it('no bids to process', async () => {
      // TODO
    })

    it('exceeds roster size limit', async () => {
      // TODO
    })

    it('exceeds roster cap limit', async () => {
      // TODO
    })

    it('tied bids among competing team', async () => {
      // TODO
    })
  })
})
