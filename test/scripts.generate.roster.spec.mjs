/* global describe before beforeEach it */
import * as chai from 'chai'
import MockDate from 'mockdate'

import knex from '#db'
import league from '#db/fixtures/league.mjs'
import draft from '#db/fixtures/draft.mjs'
import { current_season, player_tag_types } from '#constants'
import { getRoster } from '#libs-server'
import run from '#scripts/generate-rosters.mjs'

process.env.NODE_ENV = 'test'

chai.should()
const { regular_season_start, end } = current_season
const expect = chai.expect

describe('SCRIPTS /rosters - generate weekly rosters', function () {
  this.timeout(60 * 1000)

  before(async function () {
    await knex.seed.run()
  })

  describe('process', function () {
    beforeEach(async function () {
      MockDate.set(regular_season_start.subtract('1', 'month').toISOString())
      await league(knex)
    })

    it('generate rosters for week 1', async () => {
      await draft(knex)

      let error
      try {
        await run()
      } catch (err) {
        error = err
      }

      expect(error).to.equal(undefined)

      const teamId = 1
      const roster1 = await getRoster({ tid: teamId })
      const roster1Players = roster1.players.map(
        ({ lid, pid, pos, slot, tid, type }) => ({
          lid,
          pid,
          pos,
          slot,
          tid,
          type
        })
      )
      const roster2 = await getRoster({
        tid: teamId,
        week: current_season.week + 1
      })
      const roster2Players = roster2.players.map(
        ({ lid, pid, pos, slot, tid, type }) => ({
          lid,
          pid,
          pos,
          slot,
          tid,
          type
        })
      )
      expect(roster1Players).to.eql(roster2Players)

      try {
        await run()
      } catch (err) {
        error = err
      }

      expect(error).to.equal(undefined)

      const roster3 = await getRoster({ tid: teamId })
      const roster3Players = roster3.players.map(
        ({ lid, pid, pos, slot, tid, type }) => ({
          lid,
          pid,
          pos,
          slot,
          tid,
          type
        })
      )
      const roster4 = await getRoster({
        tid: teamId,
        week: current_season.week + 1
      })
      const roster4Players = roster4.players.map(
        ({ lid, pid, pos, slot, tid, type }) => ({
          lid,
          pid,
          pos,
          slot,
          tid,
          type
        })
      )
      expect(roster3Players).to.eql(roster4Players)
      expect(roster1Players).to.eql(roster3Players)
      expect(roster4.week).to.equal(current_season.week + 1)
      expect(roster4.year).to.equal(current_season.year)
    })

    it('generate rosters for next year', async () => {
      MockDate.set(regular_season_start.toISOString())

      await draft(knex)

      MockDate.set(end.add(3, 'week').toISOString())
      let error
      try {
        await run()
      } catch (err) {
        console.log(err)
        error = err
      }

      expect(error).to.equal(undefined)

      const teamId = 1
      const roster1 = await getRoster({
        tid: teamId,
        week: current_season.finalWeek,
        year: current_season.year - 1
      })
      const roster1Players = roster1.players.map(
        ({ lid, pid, pos, slot, tid, type }) => ({
          lid,
          pid,
          pos,
          slot,
          tid,
          type
        })
      )
      const roster2 = await getRoster({
        tid: teamId
      })
      const roster2Players = roster2.players.map(
        ({ lid, pid, pos, slot, tid, type }) => ({
          lid,
          pid,
          pos,
          slot,
          tid,
          type
        })
      )
      expect(roster1.year).to.equal(current_season.year - 1)
      expect(roster1Players).to.eql(roster2Players)

      try {
        await run()
      } catch (err) {
        error = err
      }

      expect(error).to.equal(undefined)

      const roster3 = await getRoster({
        tid: teamId,
        week: current_season.finalWeek,
        year: current_season.year - 1
      })
      const roster3Players = roster3.players.map(
        ({ lid, pid, pos, slot, tid, type }) => ({
          lid,
          pid,
          pos,
          slot,
          tid,
          type
        })
      )
      const roster4 = await getRoster({
        tid: teamId
      })
      const roster4Players = roster4.players.map(
        ({ lid, pid, pos, slot, tid, type }) => ({
          lid,
          pid,
          pos,
          slot,
          tid,
          type
        })
      )
      expect(roster3Players).to.eql(roster4Players)
      expect(roster1Players).to.eql(roster3Players)
      expect(roster4.week).to.equal(0)
      expect(roster4.year).to.equal(current_season.year)
    })

    it('scrubs non-REGULAR tags during year-rollover', async () => {
      MockDate.set(regular_season_start.toISOString())
      await draft(knex)

      const seed_year = current_season.year
      const final_week = current_season.finalWeek
      const team_id = 1

      const team_players = await knex('rosters_players')
        .where({ lid: 1, year: seed_year, week: 0, tid: team_id })
        .limit(2)
      expect(team_players.length).to.equal(2)
      const [franchise_player, rookie_player] = team_players

      const final_week_roster = await knex('rosters')
        .where({ lid: 1, year: seed_year, week: final_week, tid: team_id })
        .first()

      // Plant a FRANCHISE and a ROOKIE tag on year=Y0 final-week as carry-forward fodder.
      await knex('rosters_players').insert([
        {
          rid: final_week_roster.uid,
          slot: franchise_player.slot,
          pid: franchise_player.pid,
          pos: franchise_player.pos,
          tag: player_tag_types.FRANCHISE,
          extensions: 0,
          tid: team_id,
          lid: 1,
          year: seed_year,
          week: final_week
        },
        {
          rid: final_week_roster.uid,
          slot: rookie_player.slot,
          pid: rookie_player.pid,
          pos: rookie_player.pos,
          tag: player_tag_types.ROOKIE,
          extensions: 0,
          tid: team_id,
          lid: 1,
          year: seed_year,
          week: final_week
        }
      ])

      MockDate.set(end.add(3, 'week').toISOString())
      await run()

      // Insert path: year=Y1 week=0 should mint these players with tag=REGULAR.
      const new_year_rows = await knex('rosters_players')
        .where({ lid: 1, year: current_season.year, week: 0, tid: team_id })
        .whereIn('pid', [franchise_player.pid, rookie_player.pid])
      expect(new_year_rows.length).to.equal(2)
      for (const row of new_year_rows) {
        expect(row.tag).to.equal(player_tag_types.REGULAR)
      }

      // Update path: re-pollute the new-year rows and rerun; rollover should reset them.
      await knex('rosters_players')
        .where({ lid: 1, year: current_season.year, week: 0, tid: team_id })
        .whereIn('pid', [franchise_player.pid, rookie_player.pid])
        .update({ tag: player_tag_types.FRANCHISE })

      await run()

      const repolluted_rows = await knex('rosters_players')
        .where({ lid: 1, year: current_season.year, week: 0, tid: team_id })
        .whereIn('pid', [franchise_player.pid, rookie_player.pid])
      for (const row of repolluted_rows) {
        expect(row.tag).to.equal(player_tag_types.REGULAR)
      }
    })
  })

  /* describe('errors', function () {
   *   beforeEach(async function () {
   *     MockDate.set(regular_season_start.subtract('1', 'month').toISOString())
   *     await league(knex)
   *   })
   * }) */
})
