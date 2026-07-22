/* global describe, it, before, after */

import * as chai from 'chai'

import knex from '#db'
import apply_nfl_games_current_week_join from '#libs-server/data-views/join-nfl-games-current-week.mjs'

import { seed_nfl_games, clear_nfl_games } from '../fixtures/seed-nfl-games.mjs'
import { run_under_season_type } from '../fixtures/postseason.mjs'

const expect = chai.expect

const TEST_PID = 'TEST-JOIN-000905'

const seed_player = async ({ team }) => {
  await knex('player')
    .insert({
      pid: TEST_PID,
      first_name: 'Test',
      last_name: 'Player',
      short_name: 'T.Player',
      formatted_name: 'Test Player',
      primary_position: 'QB',
      secondary_position: 'QB',
      date_of_birth: '1990-01-01',
      nfl_draft_year: 2012,
      current_nfl_team: team
    })
    .onConflict('pid')
    .merge()
}

describe('LIBS-SERVER apply_nfl_games_current_week_join', function () {
  before(async function () {
    this.timeout(60 * 1000)
    await clear_nfl_games({})
    await seed_player({ team: 'KC' })
  })

  after(async function () {
    await knex('player').where({ pid: TEST_PID }).del()
  })

  run_under_season_type(
    'REG',
    function () {
      before(async () => {
        await seed_nfl_games({})
      })
      after(async () => {
        await clear_nfl_games({})
      })

      it('joins the current REG-week row and excludes POST rows', async function () {
        const query = knex('player').select(
          'player.pid',
          'nfl_games.seas_type',
          'nfl_games.week'
        )
        apply_nfl_games_current_week_join({ db: knex, query })
        const rows = await query.where('player.pid', TEST_PID)
        // Seed contains both REG and POST games for KC across all weeks; the
        // helper must match only the current REG week, not any POST row.
        expect(rows).to.have.length(1)
        expect(rows[0].seas_type).to.equal('REG')
        expect(rows[0].week).to.equal(1)
      })
    },
    { seed_nfl_games: false }
  )

  run_under_season_type(
    'POST',
    function () {
      before(async () => {
        await seed_nfl_games({})
      })
      after(async () => {
        await clear_nfl_games({})
      })

      it('joins the current POST-week row for the player team', async function () {
        const query = knex('player').select(
          'player.pid',
          'nfl_games.seas_type',
          'nfl_games.week'
        )
        apply_nfl_games_current_week_join({ db: knex, query })
        const rows = await query.where('player.pid', TEST_PID)
        expect(rows).to.have.length(1)
        expect(rows[0].seas_type).to.equal('POST')
        expect(rows[0].week).to.equal(1)
      })

      it('returns null join row when no game matches', async function () {
        await knex('player')
          .where({ pid: TEST_PID })
          .update({ current_nfl_team: 'NYG' })
        const query = knex('player').select('player.pid', 'nfl_games.seas_type')
        apply_nfl_games_current_week_join({ db: knex, query })
        const rows = await query.where('player.pid', TEST_PID)
        expect(rows).to.have.length(1)
        expect(rows[0].seas_type).to.equal(null)
        await knex('player')
          .where({ pid: TEST_PID })
          .update({ current_nfl_team: 'KC' })
      })
    },
    { seed_nfl_games: false }
  )
})
