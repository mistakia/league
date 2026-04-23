/* global describe, it, before, after */

import * as chai from 'chai'

import knex from '#db'
import apply_nfl_games_offset_week_join from '#libs-server/data-views/join-nfl-games-offset-week.mjs'

import { seed_nfl_games, clear_nfl_games } from '../fixtures/seed-nfl-games.mjs'
import { run_under_season_type } from '../fixtures/postseason.mjs'

const expect = chai.expect

const TEST_PID = 'TEST-OFF-2024-1990-01-01'

describe('LIBS-SERVER apply_nfl_games_offset_week_join', function () {
  before(async function () {
    this.timeout(60 * 1000)
    await clear_nfl_games({})
    await knex('player')
      .insert({
        pid: TEST_PID,
        fname: 'Test',
        lname: 'Offset',
        pname: 'T.Offset',
        formatted: 'Test Offset',
        pos: 'QB',
        pos1: 'QB',
        dob: '1990-01-01',
        nfl_draft_year: 2012,
        current_nfl_team: 'KC'
      })
      .onConflict('pid')
      .merge()
  })

  after(async function () {
    await knex('player').where({ pid: TEST_PID }).del()
  })

  run_under_season_type('POST', function () {
    before(async () => {
      await seed_nfl_games({})
    })
    after(async () => {
      await clear_nfl_games({})
    })

    it('offset -1 from POST week 1 joins REG week 18 game', async function () {
      const query = knex('player').select(
        'player.pid',
        'prior_game.seas_type',
        'prior_game.week'
      )
      apply_nfl_games_offset_week_join({
        db: knex,
        query,
        offset: -1,
        alias: 'prior_game'
      })
      const rows = await query.where('player.pid', TEST_PID)
      expect(rows).to.have.length(1)
      expect(rows[0].seas_type).to.equal('REG')
      expect(rows[0].week).to.equal(18)
    })

    it('offset -2 from POST week 1 joins REG week 17 game', async function () {
      const query = knex('player').select(
        'player.pid',
        'ref_game.seas_type',
        'ref_game.week'
      )
      apply_nfl_games_offset_week_join({
        db: knex,
        query,
        offset: -2,
        alias: 'ref_game'
      })
      const rows = await query.where('player.pid', TEST_PID)
      expect(rows).to.have.length(1)
      expect(rows[0].seas_type).to.equal('REG')
      expect(rows[0].week).to.equal(17)
    })
  })

  run_under_season_type('POST', function () {
    it('returns unmodified query (no join) when offset triple is null', async function () {
      const query = knex('player').select('player.pid')
      apply_nfl_games_offset_week_join({
        db: knex,
        query,
        offset: -99,
        alias: 'missing_game'
      })
      const rows = await query.where('player.pid', TEST_PID)
      expect(rows).to.have.length(1)
      expect(rows[0]).to.have.property('pid', TEST_PID)
    })
  })
})
