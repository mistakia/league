/* global describe before after it */
import * as chai from 'chai'

import db from '#db'
import { simulation } from '#libs-server'

const expect = chai.expect

/*
  nfl_games numbers POST weeks from 1 (WEEK_RANGES.POST is { min: 1, max: 4 }),
  so for weeks 1-4 a REG game and a POST game share a week NUMBER and are told
  apart only by season_type. The schedule loader keys its result by team
  abbreviation, one entry per team per week, so two such rows collide on that
  key and the last one written wins.

  Before the fix the loader admitted REG and POST together on a REG request and
  had no ORDER BY, so WHICH row won was decided by the query plan. Measured both
  ways on the seeded pair below: under an index scan the rows arrive
  POST-then-REG (season_type sorts alphabetically) and REG wins by luck, while
  under a sequential scan they arrive in insertion order and the POST game wins,
  displacing the REG game entirely. A caller then reads the POST esbid for a REG
  week, finds no gamelog for it, and drops the player from its result.

  That is why the displacement case pins the planner. Left to the default plan
  the case passes on the broken code -- a green that proves nothing, since it is
  measuring the accident rather than the contract.
*/

const season_year = 2024
const reg_esbid = 99000101
const post_esbid = 99000102
const home_nfl_team = 'ZY'
const away_nfl_team = 'ZZ'

const seed = async () => {
  await db('nfl_games').insert({
    esbid: reg_esbid,
    season_year,
    week: 1,
    season_type: 'REG',
    away_nfl_team,
    home_nfl_team
  })
  await db('nfl_games').insert({
    esbid: post_esbid,
    season_year,
    week: 1,
    season_type: 'POST',
    away_nfl_team,
    home_nfl_team
  })
}

const clear = async () => {
  await db('nfl_games').whereIn('esbid', [reg_esbid, post_esbid]).del()
}

describe('LIBS-SERVER simulation load_nfl_schedule season_type', function () {
  before(async () => {
    await clear()
    await seed()
  })

  after(clear)

  it('should return the REG game when REG is requested', async () => {
    const schedule = await simulation.load_nfl_schedule({
      season_year,
      week: 1
    })

    expect(schedule[home_nfl_team]).to.exist
    expect(schedule[home_nfl_team].esbid).to.equal(reg_esbid)
  })

  it('should return the POST game when POST is requested', async () => {
    const schedule = await simulation.load_nfl_schedule({
      season_year,
      week: 1,
      season_type: 'POST'
    })

    expect(schedule[home_nfl_team]).to.exist
    expect(schedule[home_nfl_team].esbid).to.equal(post_esbid)
  })

  describe('under a plan that returns the POST row last', function () {
    // The seeded rows arrive in insertion order under a sequential scan, which
    // puts the POST game last -- the arrangement that displaced the REG game
    // before the fix. Scoped to this block and reset afterwards so no other
    // spec inherits the setting.
    before(async () => {
      await db.raw('SET enable_indexscan = off')
      await db.raw('SET enable_bitmapscan = off')
    })

    after(async () => {
      await db.raw('RESET enable_indexscan')
      await db.raw('RESET enable_bitmapscan')
    })

    it('should not let the POST game displace the REG game for either team', async () => {
      const schedules = await simulation.load_nfl_schedules_for_weeks({
        season_year,
        weeks: [1]
      })
      const schedule = schedules.get(1)

      expect(schedule[home_nfl_team].esbid).to.equal(reg_esbid)
      expect(schedule[away_nfl_team].esbid).to.equal(reg_esbid)
    })
  })
})
