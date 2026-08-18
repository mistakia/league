/* global describe before it */
import * as chai from 'chai'

import knex from '#db'
import league from '#db/fixtures/league.mjs'
import { current_season } from '#constants'
import get_league_rosters_from_database from '#libs-server/get-league-rosters-from-database.mjs'

process.env.NODE_ENV = 'test'
const { expect } = chai

// Regression: scripts/project-lineups.mjs writes league_team_lineups and
// league_team_lineup_starters in one pass, and the two tables used to disagree on
// the type of `week` -- smallint against character varying(3). pg hands back a JS
// number for one and a JS string for the other, so this loader's
// `l.week === lineup.week` match was ALWAYS false and every roster payload carried
// an empty starter list. Nothing failed; the SPA simply rendered no starters.
// Confirmed live on 2026-08-02 against 1,411 real starter rows.
//
// The same mismatch made `.where('week', '>=', min_week)` resolve as a TEXT
// comparison, where '10' >= '2' is false, so the week floor silently dropped every
// multi-digit week. Both are asserted below because both were invisible.
describe('get-league-rosters-from-database lineup starters', function () {
  const year = current_season.year
  const lid = 1
  const tid = 1
  const pid = 'JOSH-ALLE-000098'

  before(async function () {
    this.timeout(60 * 1000)
    await knex.seed.run()
    await league(knex)

    await knex('rosters').del().where({ lid, season_year: year })
    await knex('rosters').insert(
      [1, 2, 10].map((week) => ({
        roster_id: 9000 + week,
        tid,
        lid,
        week,
        season_year: year
      }))
    )

    await knex('league_team_lineups').del().where({ lid, season_year: year })
    await knex('league_team_lineups').insert(
      [1, 2, 10].map((week) => ({
        lid,
        tid,
        season_year: year,
        week,
        optimal_total: 100 + week,
        baseline_total: 100 + week
      }))
    )

    await knex('league_team_lineup_starters')
      .del()
      .where({ lid, season_year: year })
    await knex('league_team_lineup_starters').insert(
      [1, 2, 10].map((week) => ({ lid, tid, season_year: year, week, pid }))
    )
  })

  it('matches starters to their lineup week', async function () {
    const rosters = await get_league_rosters_from_database({
      lid,
      year,
      min_week: 1
    })
    const roster = rosters.find((r) => r.tid === tid && r.week === 1)

    expect(roster, 'roster for week 1').to.exist
    expect(roster.lineups[1].starter_pids).to.eql([pid])
  })

  // The starter query also filters `week >= min_week`. Against the old varchar
  // column that resolved as a TEXT comparison, where '10' >= '2' is false --
  // verified directly on a varchar-week table, which returned week 2 and dropped
  // week 10. So a multi-digit week lost its starters twice over: once to the
  // floor and once to the join match above. This asserts the surviving path
  // end-to-end rather than trying to isolate two halves of one type mismatch.
  it('carries starters for a multi-digit week above the floor', async function () {
    const rosters = await get_league_rosters_from_database({
      lid,
      year,
      min_week: 2
    })

    const weeks = rosters.flatMap((r) => Object.keys(r.lineups)).map(Number)
    expect(weeks, 'week 1 is below the floor').to.not.include(1)

    const roster = rosters.find((r) => r.tid === tid && r.week === 10)
    expect(roster, 'roster for week 10').to.exist
    expect(roster.lineups[10].starter_pids).to.eql([pid])
  })
})
