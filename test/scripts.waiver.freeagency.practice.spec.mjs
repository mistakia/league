/* global describe before beforeEach it */
import * as chai from 'chai'
import MockDate from 'mockdate'

import knex from '#db'
import league from '#db/seeds/league.mjs'
import { constants, getDraftDates, Errors } from '#libs-shared'
import { getLeague } from '#libs-server'
import {
  selectPlayer,
  checkLastTransaction,
  checkRoster
} from './utils/index.mjs'
import run from '../scripts/process-waivers-free-agency-practice.mjs'

process.env.NODE_ENV = 'test'

chai.should()
const expect = chai.expect
const { regular_season_start } = constants.season

describe('SCRIPTS /waivers - free agency - practice', function () {
  before(async function () {
    this.timeout(60 * 1000)
    await knex.seed.run()
  })

  describe('process', function () {
    beforeEach(async function () {
      this.timeout(60 * 1000)
      MockDate.set(regular_season_start.subtract('2', 'month').toISOString())
      await league(knex)
    })

    it('rookie post draft single waiver - offseason', async () => {
      const lid = 1
      const league = await getLeague({ lid })
      const picks = await knex('draft')
      const draftDates = getDraftDates({
        start: league.draft_start,
        picks: picks.length,
        type: league.draft_type,
        min: league.draft_hour_min,
        max: league.draft_hour_max
      })
      MockDate.set(draftDates.waiverEnd.toISOString())

      const player = await selectPlayer({ rookie: true })
      const teamId = 1
      await knex('waivers').insert({
        tid: teamId,
        userid: 1,
        lid,
        pid: player.pid,
        po: 9999,
        submitted: Math.round(Date.now() / 1000),
        bid: 0,
        type: constants.waivers.FREE_AGENCY_PRACTICE
      })

      let error
      try {
        await run({ daily: true })
      } catch (err) {
        console.log(err)
        error = err
      }

      expect(error).to.equal(undefined)

      // check waivers
      const waivers = await knex('waivers')
      expect(waivers.length).to.equal(1)
      expect(waivers[0].pid).to.equal(player.pid)
      expect(waivers[0].succ).to.equal(true)
      expect(waivers[0].reason).to.equal(null)
      expect(waivers[0].processed).to.equal(Math.round(Date.now() / 1000))
      expect(waivers[0].cancelled).to.equal(null)

      // check team waiver order
      const teams = await knex('teams').where({
        lid: 1,
        year: constants.season.year
      })
      const team1 = teams.find((t) => t.uid === 1)
      const team2 = teams.find((t) => t.uid === 2)
      const team3 = teams.find((t) => t.uid === 3)
      const team4 = teams.find((t) => t.uid === 4)
      expect(team1.waiver_order).to.equal(12)
      expect(team2.waiver_order).to.equal(1)
      expect(team3.waiver_order).to.equal(2)
      expect(team4.waiver_order).to.equal(3)

      // verify roster
      await checkRoster({
        teamId,
        pid: player.pid,
        leagueId: lid
      })

      // verify transaction
      await checkLastTransaction({
        leagueId: lid,
        pid: player.pid,
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
      const lid = 1
      const league = await getLeague({ lid })
      const picks = await knex('draft')
      const draftDates = getDraftDates({
        start: league.draft_start,
        type: league.draft_type,
        min: league.draft_hour_min,
        max: league.draft_hour_max,
        picks: picks.length
      })
      MockDate.set(draftDates.draftEnd.add('1', 'hour').toISOString())

      const player = await selectPlayer({ rookie: true })
      const teamId = 1
      await knex('waivers').insert({
        tid: teamId,
        userid: 1,
        lid,
        pid: player.pid,
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
      expect(waivers[0].pid).to.equal(player.pid)
      expect(waivers[0].succ).to.equal(null)
      expect(waivers[0].reason).to.equal(null)
      expect(waivers[0].processed).to.equal(null)
      expect(waivers[0].cancelled).to.equal(null)

      // check team waiver order
      const teams = await knex('teams').where({
        lid: 1,
        year: constants.season.year
      })
      const team1 = teams.find((t) => t.uid === 1)
      const team2 = teams.find((t) => t.uid === 2)
      const team3 = teams.find((t) => t.uid === 3)
      const team4 = teams.find((t) => t.uid === 4)
      expect(team1.waiver_order).to.equal(1)
      expect(team2.waiver_order).to.equal(2)
      expect(team3.waiver_order).to.equal(3)
      expect(team4.waiver_order).to.equal(4)

      expect(team1.faab).to.equal(200)
    })
  })

  describe('errors', function () {
    beforeEach(async function () {
      this.timeout(60 * 1000)
      MockDate.set(regular_season_start.subtract('1', 'month').toISOString())
      await league(knex)
    })

    it('no waivers to process', async () => {
      MockDate.set(regular_season_start.add('1', 'month').day(4).toISOString())
      let error
      try {
        await run()
      } catch (err) {
        error = err
      }

      expect(error).to.be.instanceof(Errors.EmptyPracticeSquadFreeAgencyWaivers)
      expect(error.message).to.equal(
        'no practice squad free agency waivers to process'
      )
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
