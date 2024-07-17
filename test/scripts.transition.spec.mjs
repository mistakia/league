/* global describe before beforeEach it */
import chai from 'chai'
import MockDate from 'mockdate'

import knex from '#db'
import league from '#db/seeds/league.mjs'
import { constants, Roster } from '#libs-shared'
import { getLeague, getRoster } from '#libs-server'
import {
  selectPlayer,
  checkLastTransaction,
  checkRoster,
  addPlayer,
  fillRoster
} from './utils/index.mjs'
import run from '#scripts/process-transition-bids.mjs'

process.env.NODE_ENV = 'test'

chai.should()
const expect = chai.expect
const { start } = constants.season

describe('SCRIPTS - transition bids - restricted free agency', function () {
  const leagueId = 1

  before(async function () {
    this.timeout(60 * 1000)

    MockDate.set(start.subtract('1', 'month').toISOString())
    await knex.seed.run()
  })

  describe('process', function () {
    beforeEach(async function () {
      this.timeout(60 * 1000)
      await league(knex)
      const tranDate = start.subtract('5', 'week').unix()
      const extDate = start.subtract('6', 'week').unix()
      await knex('seasons')
        .update({
          year: constants.season.year,
          tran_start: tranDate,
          tran_end: tranDate,
          ext_date: extDate
        })
        .where({
          lid: leagueId
        })
      MockDate.set(start.subtract('1', 'month').toISOString())
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
        userId,
        tag: constants.tags.TRANSITION
      })

      const timestamp = Math.round(Date.now() / 1000)
      await knex('transition_bids').insert({
        pid: player.pid,
        userid: userId,
        bid: value,
        tid: teamId,
        year: constants.season.year,
        player_tid: teamId,
        lid: leagueId,
        submitted: timestamp,
        announced: timestamp - 1
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
      expect(transitionBids[0].succ).to.equal(true)
      expect(transitionBids[0].processed).to.equal(timestamp)
      expect(transitionBids[0].reason).to.equal(null)

      // verify roster
      await checkRoster({
        teamId,
        pid: player.pid,
        leagueId
      })

      // verify transaction
      await checkLastTransaction({
        leagueId,
        pid: player.pid,
        teamId,
        userId: 1,
        value,
        type: constants.transactions.TRANSITION_TAG
      })
    })

    it('process single bid with cutlist and conditional release', async () => {
      const exclude_pids = []
      const player1 = await selectPlayer() // 30 - rfa
      exclude_pids.push(player1.pid)
      const player2 = await selectPlayer({ exclude_pids }) // 20 - cutlist
      exclude_pids.push(player2.pid)
      const player3 = await selectPlayer({ exclude_pids }) // 20 - cutlist
      exclude_pids.push(player3.pid)
      const player4 = await selectPlayer({ exclude_pids }) // 20 - release
      exclude_pids.push(player4.pid)
      const player5 = await selectPlayer({ exclude_pids }) // 160 - high salary retained
      exclude_pids.push(player5.pid)

      const teamId = 1
      const userId = 1
      const bid = 30

      await addPlayer({
        leagueId,
        player: player1,
        teamId,
        userId,
        value: 20,
        tag: constants.tags.TRANSITION
      })

      const players = [player2, player3, player4]
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

      await fillRoster({ leagueId, teamId, excludeIR: true, exclude_pids })

      const timestamp = Math.round(Date.now() / 1000)
      const query1 = await knex('transition_bids')
        .insert({
          pid: player1.pid,
          userid: userId,
          bid,
          tid: teamId,
          year: constants.season.year,
          player_tid: teamId,
          lid: leagueId,
          submitted: timestamp,
          announced: timestamp - 1
        })
        .returning('uid')

      await knex('transition_releases').insert({
        transitionid: query1[0].uid,
        pid: player4.pid
      })

      const cutlist = [player2, player3].map((p, idx) => ({
        pid: p.pid,
        order: idx,
        tid: teamId
      }))
      await knex('league_cutlist').insert(cutlist)

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
      expect(transitionBids[0].succ).to.equal(true)
      expect(transitionBids[0].processed).to.equal(timestamp)
      expect(transitionBids[0].reason).to.equal(null)

      // verify roster
      await checkRoster({
        teamId,
        pid: player1.pid,
        leagueId
      })

      // verify transaction
      await checkLastTransaction({
        leagueId,
        pid: player1.pid,
        teamId,
        userId: 1,
        value: bid,
        type: constants.transactions.TRANSITION_TAG
      })

      // verify released players
      const league = await getLeague({ lid: leagueId })
      const rosterRow = await getRoster({ tid: teamId })
      const roster = new Roster({ roster: rosterRow, league })

      expect(roster.has(player2.pid)).to.equal(false)
      expect(roster.has(player3.pid)).to.equal(false)
      expect(roster.has(player4.pid)).to.equal(false)

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
      MockDate.set(start.subtract('1', 'month').toISOString())
      await league(knex)
    })

    it('no bids to process', async () => {
      const tranDate = start.subtract('1', 'week').unix()
      await knex('seasons')
        .update({
          year: constants.season.year,
          tran_end: tranDate
        })
        .where({
          lid: leagueId
        })

      const player = await selectPlayer()
      const teamId = 1
      const value = 10
      const userId = 1

      await addPlayer({
        leagueId,
        player,
        teamId,
        userId,
        tag: constants.tags.TRANSITION
      })

      const timestamp = Math.round(Date.now() / 1000)
      await knex('transition_bids').insert({
        pid: player.pid,
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
      expect(transitionBids[0].succ).to.equal(null)
      expect(transitionBids[0].processed).to.equal(null)
      expect(transitionBids[0].reason).to.equal(null)
    })

    it('exceeds roster size limit', async () => {
      // TODO
    })

    it('exceeds roster cap limit', async () => {
      // TODO
    })

    it('tied bids among competing team', async () => {
      const tranDate = start.subtract('1', 'month').unix()
      await knex('seasons')
        .update({
          year: constants.season.year,
          tran_end: tranDate
        })
        .where({
          lid: leagueId
        })

      const player = await selectPlayer()
      const teamId = 1
      const teamId2 = 2
      const teamId3 = 3
      const value1 = 10
      const value2 = 13
      const userId = 1
      const userId2 = 2
      const userId3 = 3

      await addPlayer({
        leagueId,
        player,
        teamId,
        userId,
        tag: constants.tags.TRANSITION
      })

      const timestamp = Math.round(Date.now() / 1000)
      await knex('transition_bids').insert({
        pid: player.pid,
        userid: userId,
        bid: value1,
        tid: teamId,
        year: constants.season.year,
        player_tid: teamId,
        lid: leagueId,
        submitted: timestamp
      })

      await knex('transition_bids').insert({
        pid: player.pid,
        userid: userId2,
        bid: value2,
        tid: teamId2,
        year: constants.season.year,
        player_tid: teamId,
        lid: leagueId,
        submitted: timestamp
      })

      await knex('transition_bids').insert({
        pid: player.pid,
        userid: userId3,
        bid: value2,
        tid: teamId3,
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
      expect(transitionBids.length).to.equal(3)
      expect(transitionBids[0].succ).to.equal(null)
      expect(transitionBids[0].processed).to.equal(null)
      expect(transitionBids[0].reason).to.equal(null)

      expect(transitionBids[1].succ).to.equal(null)
      expect(transitionBids[1].processed).to.equal(null)
      expect(transitionBids[1].reason).to.equal(null)

      expect(transitionBids[2].succ).to.equal(null)
      expect(transitionBids[2].processed).to.equal(null)
      expect(transitionBids[2].reason).to.equal(null)
    })
  })
})
