/* global describe, it, before, after */

import * as chai from 'chai'

import knex from '#db'
import apply_practice_current_week_join from '#libs-server/data-views/join-practice-current-week.mjs'
import { current_season } from '#constants'

import { run_under_season_type } from '../fixtures/postseason.mjs'

const expect = chai.expect

const TEST_PID = 'TEST-PRAC-000914'

const seed_player = async () => {
  await knex('player')
    .insert({
      pid: TEST_PID,
      first_name: 'Test',
      last_name: 'Practice',
      short_name: 'T.Practice',
      formatted_name: 'Test Practice',
      primary_position: 'QB',
      secondary_position: 'QB',
      date_of_birth: '1990-01-01',
      nfl_draft_year: 2012,
      current_nfl_team: 'KC'
    })
    .onConflict('pid')
    .merge()
}

describe('LIBS-SERVER apply_practice_current_week_join', function () {
  before(async function () {
    this.timeout(60 * 1000)
    await knex('practice').where({ pid: TEST_PID }).del()
    await seed_player()
  })

  after(async function () {
    await knex('practice').where({ pid: TEST_PID }).del()
    await knex('player').where({ pid: TEST_PID }).del()
  })

  run_under_season_type('REG', function () {
    before(async () => {
      await knex('practice').where({ pid: TEST_PID }).del()
      await knex('practice').insert({
        pid: TEST_PID,
        year: current_season.stats_season_year,
        seas_type: 'REG',
        week: Math.max(current_season.week, 1),
        game_designation: 'REG-MATCH'
      })
      await knex('practice').insert({
        pid: TEST_PID,
        year: current_season.stats_season_year,
        seas_type: 'POST',
        week: 1,
        game_designation: 'POST-UNUSED'
      })
    })
    after(async () => {
      await knex('practice').where({ pid: TEST_PID }).del()
    })

    it('joins the current REG-week practice row', async function () {
      const query = knex('player').select(
        'player.pid',
        'practice.seas_type',
        'practice.game_designation'
      )
      apply_practice_current_week_join({ db: knex, query })
      const rows = await query.where('player.pid', TEST_PID)
      expect(rows).to.have.length(1)
      expect(rows[0].seas_type).to.equal('REG')
      expect(rows[0].game_designation).to.equal('REG-MATCH')
    })
  })

  run_under_season_type('POST', function () {
    before(async () => {
      await knex('practice').where({ pid: TEST_PID }).del()
      await knex('practice').insert({
        pid: TEST_PID,
        year: current_season.stats_season_year,
        seas_type: 'POST',
        week: 1,
        game_designation: 'POST-MATCH'
      })
      await knex('practice').insert({
        pid: TEST_PID,
        year: current_season.stats_season_year,
        seas_type: 'REG',
        week: 18,
        game_designation: 'REG-UNUSED'
      })
    })
    after(async () => {
      await knex('practice').where({ pid: TEST_PID }).del()
    })

    it('joins the current POST-week practice row (not the REG week 18 row)', async function () {
      const query = knex('player').select(
        'player.pid',
        'practice.seas_type',
        'practice.game_designation'
      )
      apply_practice_current_week_join({ db: knex, query })
      const rows = await query.where('player.pid', TEST_PID)
      expect(rows).to.have.length(1)
      expect(rows[0].seas_type).to.equal('POST')
      expect(rows[0].game_designation).to.equal('POST-MATCH')
    })
  })
})
