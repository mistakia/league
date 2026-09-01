/* global describe before beforeEach it */
import * as chai from 'chai'
import fs from 'fs'
import MockDate from 'mockdate'

import knex from '#db'
import league from '#db/fixtures/league.mjs'
import { current_season } from '#constants'
import {
  LEAGUE_SCOPED_TABLES,
  parse_league_scoped_tables,
  wipe_league,
  clone_league_board
} from '#libs-server/clone-league.mjs'

process.env.NODE_ENV = 'test'
const expect = chai.expect

describe('clone-league', function () {
  describe('the table set', function () {
    it('uses the same pattern as the coverage gate, compared as source', function () {
      // The clone duplicates the gate's regex because the gate is a SCRIPT: it
      // runs on import AND calls process.exit on failure, so importing it from a
      // spec would kill the whole mocha run mid-suite and read as a hang rather
      // than a failure. I did import it at first; this is the repair.
      //
      // So the drift check reads the gate's SOURCE and compares the pattern
      // literal rather than executing anything. If either side edits its regex,
      // this fails and names the divergence.
      const gate_source = fs.readFileSync(
        'db/gates/check-league-fixture-reset-coverage.mjs',
        'utf8'
      )
      const clone_source = fs.readFileSync(
        'libs-server/clone-league.mjs',
        'utf8'
      )

      const pattern_of = (source) => {
        const match = source.match(/const re = (\/\(\?:knex.*?\/g)\n/)
        expect(match, 'reset-list pattern not found').to.not.equal(null)
        return match[1]
      }

      expect(pattern_of(clone_source)).to.equal(pattern_of(gate_source))
    })

    it('picks up a newly added league-scoped table with no edit', function () {
      // The property that makes this derived rather than restated.
      const synthetic = `
        export default async function reset_league_tables(knex) {
          await knex('transactions').del()
          await knex('a_table_added_tomorrow').del()
        }
      `
      expect(parse_league_scoped_tables(synthetic)).to.include(
        'a_table_added_tomorrow'
      )
    })

    it('carries both auction tables', function () {
      expect(LEAGUE_SCOPED_TABLES).to.include('auction_elections')
      expect(LEAGUE_SCOPED_TABLES).to.include('auction_block_opt_ins')
    })
  })

  describe('the league 1 refusal', function () {
    it('refuses to wipe league 1, with no flag to override', async function () {
      // The whole safety property of this script. A mistyped --to must not be
      // able to clear the live league.
      let error = null
      try {
        await wipe_league({ trx: knex, lid: 1 })
      } catch (err) {
        error = err
      }

      expect(error).to.not.equal(null)
      expect(error.message).to.include('refusing to wipe league 1')
    })

    it('refuses to clone into league 1', async function () {
      let error = null
      try {
        await clone_league_board({
          trx: knex,
          from_lid: 2,
          to_lid: 1,
          season_year: current_season.year
        })
      } catch (err) {
        error = err
      }

      expect(error).to.not.equal(null)
      expect(error.message).to.include('refusing to clone into league 1')
    })

    it('refuses a wipe with no explicit lid', async function () {
      let error = null
      try {
        await wipe_league({ trx: knex, lid: undefined })
      } catch (err) {
        error = err
      }

      expect(error).to.not.equal(null)
      expect(error.message).to.include('explicit lid')
    })
  })

  describe('cloning a board', function () {
    before(async function () {
      this.timeout(60 * 1000)
      MockDate.set(
        current_season.regular_season_start.subtract('1', 'month').toISOString()
      )
      await knex.seed.run()
    })

    beforeEach(async function () {
      this.timeout(60 * 1000)
      await league(knex)
    })

    it('copies the board and leaves the auction history behind', async function () {
      const season_year = current_season.year
      const to_lid = 99

      const source_teams = await knex('teams').where({ lid: 1, season_year })
      expect(source_teams.length).to.be.greaterThan(0)

      await knex.transaction(async (trx) => {
        await clone_league_board({
          trx,
          from_lid: 1,
          to_lid,
          season_year
        })
      })

      const cloned_teams = await knex('teams').where({
        lid: to_lid,
        season_year
      })
      expect(cloned_teams.length).to.equal(source_teams.length)

      // New team ids, not the source's. A clone that reused them would be
      // writing into the source league's rows.
      const source_ids = new Set(source_teams.map((t) => t.team_id))
      for (const team of cloned_teams) {
        expect(source_ids.has(team.team_id)).to.equal(false)
      }

      // The socket reads AUCTION_BID rows to find the last nomination, so a
      // copied auction history would make it resume mid-auction on a league
      // that never started one.
      const auction_rows = await knex('transactions')
        .where({ lid: to_lid })
        .whereIn('type', [6, 7])
      expect(auction_rows).to.have.length(0)
    })

    it('wipes what it cloned', async function () {
      const season_year = current_season.year
      const to_lid = 98

      await knex.transaction(async (trx) => {
        await clone_league_board({ trx, from_lid: 1, to_lid, season_year })
      })
      expect(
        (await knex('teams').where({ lid: to_lid, season_year })).length
      ).to.be.greaterThan(0)

      await knex.transaction(async (trx) => {
        await wipe_league({ trx, lid: to_lid })
      })

      expect(await knex('teams').where({ lid: to_lid })).to.have.length(0)
      expect(
        await knex('rosters_players').where({ lid: to_lid })
      ).to.have.length(0)
      expect(await knex('transactions').where({ lid: to_lid })).to.have.length(
        0
      )
    })
  })
})
