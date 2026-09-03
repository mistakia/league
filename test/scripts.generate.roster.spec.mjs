/* global describe before beforeEach it */
import * as chai from 'chai'
import MockDate from 'mockdate'

import knex from '#db'
import league from '#db/fixtures/league.mjs'
import draft from '#db/fixtures/draft.mjs'
import { current_season, player_tag_types, roster_slot_types } from '#constants'
import { getRoster } from '#libs-server'
import run, { check_slice_matches_source } from '#scripts/generate-rosters.mjs'

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

    it('does not materialize a forward slice in the offseason', async () => {
      // A month out from `regular_season_start`, week 1 is not real yet. The
      // slice would freeze at whatever week 0 held tonight and then drift from
      // it for weeks, which is what mispriced team 6's 2026 restricted free
      // agency bids -- so nothing beyond week 0 may be written.
      MockDate.set(regular_season_start.subtract('1', 'month').toISOString())
      await draft(knex)

      let error
      try {
        await run()
      } catch (err) {
        error = err
      }

      expect(error).to.equal(undefined)

      const forward_rows = await knex('rosters_players').where({
        lid: 1,
        season_year: current_season.year,
        week: 1
      })
      expect(forward_rows.length).to.equal(0)

      const week_zero_rows = await knex('rosters_players').where({
        lid: 1,
        season_year: current_season.year,
        week: 0
      })
      expect(week_zero_rows.length).to.be.greaterThan(0)
    })

    it('generate rosters for week 1', async () => {
      // Inside the lead window: week 1 is days away and must exist by kickoff.
      MockDate.set(regular_season_start.subtract('2', 'day').toISOString())
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
        ({ lid, pid, player_position, slot, tid, type }) => ({
          lid,
          pid,
          player_position,
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
        ({ lid, pid, player_position, slot, tid, type }) => ({
          lid,
          pid,
          player_position,
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
        ({ lid, pid, player_position, slot, tid, type }) => ({
          lid,
          pid,
          player_position,
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
        ({ lid, pid, player_position, slot, tid, type }) => ({
          lid,
          pid,
          player_position,
          slot,
          tid,
          type
        })
      )
      expect(roster3Players).to.eql(roster4Players)
      expect(roster1Players).to.eql(roster3Players)
      expect(roster4.week).to.equal(current_season.week + 1)
      expect(roster4.season_year).to.equal(current_season.year)
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
        week: current_season.final_week,
        year: current_season.year - 1
      })
      const roster1Players = roster1.players.map(
        ({ lid, pid, player_position, slot, tid, type }) => ({
          lid,
          pid,
          player_position,
          slot,
          tid,
          type
        })
      )
      const roster2 = await getRoster({
        tid: teamId
      })
      const roster2Players = roster2.players.map(
        ({ lid, pid, player_position, slot, tid, type }) => ({
          lid,
          pid,
          player_position,
          slot,
          tid,
          type
        })
      )
      expect(roster1.season_year).to.equal(current_season.year - 1)
      expect(roster1Players).to.eql(roster2Players)

      try {
        await run()
      } catch (err) {
        error = err
      }

      expect(error).to.equal(undefined)

      const roster3 = await getRoster({
        tid: teamId,
        week: current_season.final_week,
        year: current_season.year - 1
      })
      const roster3Players = roster3.players.map(
        ({ lid, pid, player_position, slot, tid, type }) => ({
          lid,
          pid,
          player_position,
          slot,
          tid,
          type
        })
      )
      const roster4 = await getRoster({
        tid: teamId
      })
      const roster4Players = roster4.players.map(
        ({ lid, pid, player_position, slot, tid, type }) => ({
          lid,
          pid,
          player_position,
          slot,
          tid,
          type
        })
      )
      expect(roster3Players).to.eql(roster4Players)
      expect(roster1Players).to.eql(roster3Players)
      expect(roster4.week).to.equal(0)
      expect(roster4.season_year).to.equal(current_season.year)
    })

    it('reports a slot-only drift the membership check cannot see', async () => {
      // The 2026-09-02 incident: week 1 held exactly the right players in the
      // wrong slots, so the `tid:pid` membership comparison read clean for days
      // while the forecast pipeline consumed the drifted slice.
      //
      // Drive the check directly rather than through `run()`. The job REPAIRS
      // this drift on its next pass, so a control that goes through it cannot
      // observe the broken state at all -- it would assert against a slice the
      // writer has already fixed and pass for the wrong reason.
      MockDate.set(regular_season_start.subtract('2', 'day').toISOString())
      await draft(knex)
      await run()

      const league_row = { league_id: 1 }
      const next_week = current_season.week + 1
      // In-season path: tags carry forward unscrubbed, which is what this run is.
      const next_tag = (p) => p.tag

      const check_args = {
        league: league_row,
        previous_year: current_season.year,
        previous_week: current_season.week,
        next_week,
        next_tag
      }

      // Unperturbed reading. Per the verification rule this is half the
      // evidence: without it a red control is indistinguishable from a check
      // that was already red for an unrelated reason.
      const clean_failures = []
      await check_slice_matches_source({
        ...check_args,
        slice_failures: clean_failures
      })
      expect(clean_failures).to.eql([])

      // Mutate ONE slot in the generated slice, leaving membership identical.
      const target = await knex('rosters_players')
        .where({
          lid: 1,
          season_year: current_season.year,
          week: next_week,
          slot: roster_slot_types.BENCH
        })
        .first()
      expect(target, 'fixture must have a benched player to move').to.exist

      const mutated_count = await knex('rosters_players')
        .where({
          lid: 1,
          season_year: current_season.year,
          week: next_week,
          tid: target.tid,
          pid: target.pid
        })
        .update({ slot: roster_slot_types.RESERVE_SHORT_TERM })
      // Assert the mutation landed. A control whose setup silently no-ops is
      // indistinguishable from a control that ran.
      expect(mutated_count).to.equal(1)

      // Membership is UNCHANGED by the mutation, which is the whole point: this
      // is the decoy proving the widening is load-bearing rather than a
      // restatement of the check it replaced.
      const key_of = ({ tid, pid }) => `${tid}:${pid}`
      const source_keys = (
        await knex('rosters_players')
          .select('tid', 'pid')
          .where({ lid: 1, season_year: current_season.year, week: 0 })
      ).map(key_of)
      const generated_keys = (
        await knex('rosters_players')
          .select('tid', 'pid')
          .where({ lid: 1, season_year: current_season.year, week: next_week })
      ).map(key_of)
      expect([...source_keys].sort()).to.eql([...generated_keys].sort())

      // Must-report reading.
      const drift_failures = []
      await check_slice_matches_source({
        ...check_args,
        slice_failures: drift_failures
      })
      expect(drift_failures.length).to.equal(1)
      expect(drift_failures[0]).to.contain('0 missing, 0 extra')
      expect(drift_failures[0]).to.contain('1 slot/tag drift')
      expect(drift_failures[0]).to.contain(key_of(target))

      // The two readings differ, which is what makes either of them evidence.
      expect(drift_failures).to.not.eql(clean_failures)
    })

    it('follows a week 0 slot change into the forward slice', async () => {
      // The repair half: the drift above is only a detection problem if the
      // write path already handles it. A source slot change must reach the
      // generated slice on the next run, and the run must stay green.
      MockDate.set(regular_season_start.subtract('2', 'day').toISOString())
      await draft(knex)
      await run()

      const next_week = current_season.week + 1
      const target = await knex('rosters_players')
        .where({
          lid: 1,
          season_year: current_season.year,
          week: 0,
          slot: roster_slot_types.BENCH
        })
        .first()
      expect(target, 'fixture must have a benched player to move').to.exist

      const moved = await knex('rosters_players')
        .where({
          lid: 1,
          season_year: current_season.year,
          week: 0,
          tid: target.tid,
          pid: target.pid
        })
        .update({ slot: roster_slot_types.RESERVE_SHORT_TERM })
      expect(moved).to.equal(1)

      let error
      try {
        await run()
      } catch (err) {
        error = err
      }
      expect(error).to.equal(undefined)

      const forward_row = await knex('rosters_players')
        .where({
          lid: 1,
          season_year: current_season.year,
          week: next_week,
          tid: target.tid,
          pid: target.pid
        })
        .first()
      expect(forward_row.slot).to.equal(roster_slot_types.RESERVE_SHORT_TERM)
    })

    it('scrubs non-REGULAR tags during year-rollover', async () => {
      MockDate.set(regular_season_start.toISOString())
      await draft(knex)

      const seed_year = current_season.year
      const final_week = current_season.final_week
      const team_id = 1

      const team_players = await knex('rosters_players')
        .where({ lid: 1, season_year: seed_year, week: 0, tid: team_id })
        .limit(2)
      expect(team_players.length).to.equal(2)
      const [franchise_player, rookie_player] = team_players

      const final_week_roster = await knex('rosters')
        .where({
          lid: 1,
          season_year: seed_year,
          week: final_week,
          tid: team_id
        })
        .first()

      // Plant a FRANCHISE and a ROOKIE tag on year=Y0 final-week as carry-forward fodder.
      await knex('rosters_players').insert([
        {
          roster_id: final_week_roster.roster_id,
          slot: franchise_player.slot,
          pid: franchise_player.pid,
          player_position: franchise_player.player_position,
          tag: player_tag_types.FRANCHISE,
          extensions: 0,
          tid: team_id,
          lid: 1,
          season_year: seed_year,
          week: final_week
        },
        {
          roster_id: final_week_roster.roster_id,
          slot: rookie_player.slot,
          pid: rookie_player.pid,
          player_position: rookie_player.player_position,
          tag: player_tag_types.ROOKIE,
          extensions: 0,
          tid: team_id,
          lid: 1,
          season_year: seed_year,
          week: final_week
        }
      ])

      MockDate.set(end.add(3, 'week').toISOString())
      await run()

      // Insert path: year=Y1 week=0 should mint these players with tag=REGULAR.
      const new_year_rows = await knex('rosters_players')
        .where({
          lid: 1,
          season_year: current_season.year,
          week: 0,
          tid: team_id
        })
        .whereIn('pid', [franchise_player.pid, rookie_player.pid])
      expect(new_year_rows.length).to.equal(2)
      for (const row of new_year_rows) {
        expect(row.tag).to.equal(player_tag_types.REGULAR)
      }

      // Update path: re-pollute the new-year rows and rerun; rollover should reset them.
      await knex('rosters_players')
        .where({
          lid: 1,
          season_year: current_season.year,
          week: 0,
          tid: team_id
        })
        .whereIn('pid', [franchise_player.pid, rookie_player.pid])
        .update({ tag: player_tag_types.FRANCHISE })

      await run()

      const repolluted_rows = await knex('rosters_players')
        .where({
          lid: 1,
          season_year: current_season.year,
          week: 0,
          tid: team_id
        })
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
