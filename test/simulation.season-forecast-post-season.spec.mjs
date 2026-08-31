/* global describe before beforeEach it */
import * as chai from 'chai'

import knex from '#db'
import { current_season } from '#constants'
import { simulate_season_forecast } from '#libs-server/simulation/simulate-season-forecast.mjs'
import league_fixture from '#db/fixtures/league.mjs'

process.env.NODE_ENV = 'test'

const expect = chai.expect

// The regular season is over, so playoff, bye and division odds are decided
// and the forecast reports them as 1 or 0 rather than simulating them.
//
// Who holds a BYE is the question this covers. It used to be answered by
// reading `regular_season_finish` back out of league_team_seasonlogs and
// comparing it to bye_count, which is a different question: that column is a
// rank on the standings ladder, and a league whose byes are awarded on All Play
// ranks its bye candidates on a ladder of their own. The two agreed only
// because calculate-standings happens to write that finish from the same
// get_playoff_seeding call the forecast already makes here.
//
// It also failed silently. The column is nullable with no default, so a season
// whose standings run has not happened yet awarded NO team a bye -- and a
// zero-bye field sends all six teams into the wildcard round, which is a
// bracket this league never plays, reported as ordinary championship odds.
const LEAGUE_ID = 1
const TEAM_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
const WILDCARD_WEEK = 15
const CHAMPIONSHIP_WEEKS = [16, 17]

// Byes on All Play, two berths on record, the rest at large on points for --
// league 1's live 2026 format.
const ALL_PLAY_BYE_FORMAT = {
  playoff_team_count: 6,
  bye_count: 2,
  bye_candidate_pool: 'league',
  bye_selection_method: 'all_play',
  at_large_selection_method: 'points_for',
  has_division_winner_berths: false,
  head_to_head_berth_count: 2
}

// Record and All Play deliberately disagree. Teams 1 and 2 lead the league on
// head-to-head record; teams 5 and 6 lead it by a distance on All Play. Under
// this format the byes belong to 5 and 6, and the two record berths to 1 and 2.
const STANDINGS = [
  { tid: 1, regular_season_wins: 12, all_play_wins: 100, points_for: 1600 },
  { tid: 2, regular_season_wins: 11, all_play_wins: 98, points_for: 1590 },
  { tid: 3, regular_season_wins: 10, all_play_wins: 96, points_for: 1580 },
  { tid: 4, regular_season_wins: 9, all_play_wins: 94, points_for: 1570 },
  { tid: 5, regular_season_wins: 8, all_play_wins: 140, points_for: 1560 },
  { tid: 6, regular_season_wins: 7, all_play_wins: 138, points_for: 1550 },
  { tid: 7, regular_season_wins: 6, all_play_wins: 60, points_for: 1400 },
  { tid: 8, regular_season_wins: 5, all_play_wins: 55, points_for: 1390 },
  { tid: 9, regular_season_wins: 4, all_play_wins: 50, points_for: 1380 },
  { tid: 10, regular_season_wins: 3, all_play_wins: 45, points_for: 1370 },
  { tid: 11, regular_season_wins: 2, all_play_wins: 40, points_for: 1360 },
  { tid: 12, regular_season_wins: 1, all_play_wins: 35, points_for: 1350 }
]

const REGULAR_SEASON_GAMES = 14
const ALL_PLAY_GAMES = REGULAR_SEASON_GAMES * (TEAM_IDS.length - 1)

const EXPECTED_BYE_TIDS = [5, 6]
const EXPECTED_FIELD_TIDS = [1, 2, 3, 4, 5, 6]

const seed_seasonlogs = async ({ finish_by_tid = {} }) =>
  knex('league_team_seasonlogs').insert(
    STANDINGS.map((team) => ({
      lid: LEAGUE_ID,
      tid: team.tid,
      season_year: current_season.year,
      regular_season_wins: team.regular_season_wins,
      regular_season_losses: REGULAR_SEASON_GAMES - team.regular_season_wins,
      regular_season_ties: 0,
      all_play_wins: team.all_play_wins,
      all_play_losses: ALL_PLAY_GAMES - team.all_play_wins,
      all_play_ties: 0,
      points_for: team.points_for,
      regular_season_finish: finish_by_tid[team.tid] ?? null
    }))
  )

const seed_playoff_field = async ({ tids }) =>
  knex('playoffs').insert(
    tids.flatMap((tid) =>
      [WILDCARD_WEEK, ...CHAMPIONSHIP_WEEKS].map((week) => ({
        playoff_week_number: week - WILDCARD_WEEK + 1,
        tid,
        lid: LEAGUE_ID,
        season_year: current_season.year,
        week,
        points: null
      }))
    )
  )

// Flat, distinct per team so a champion is well defined without asserting who.
const load_playoff_scores = async ({ team_ids, weeks, n_simulations }) => {
  const by_week = new Map()
  for (const week of weeks) {
    const raw_team_scores = new Map()
    for (const [team_index, team_id] of team_ids.entries()) {
      const vector = new Array(n_simulations)
      for (let index = 0; index < n_simulations; index++) {
        vector[index] =
          100 +
          team_index +
          Math.sin((index + week) * (0.7 + team_index * 0.1)) * 20
      }
      raw_team_scores.set(team_id, vector)
    }
    by_week.set(week, raw_team_scores)
  }
  return by_week
}

const run = () =>
  simulate_season_forecast({
    league_id: LEAGUE_ID,
    year: current_season.year,
    n_simulations: 200,
    seed: 7,
    load_playoff_scores
  })

describe('SIMULATION season forecast post season', function () {
  this.timeout(60 * 1000)

  before(async function () {
    await knex.seed.run()
  })

  beforeEach(async function () {
    await league_fixture(knex)
    // No remaining matchups is what routes the forecast into the decided-season
    // branch this file covers.
    await knex('matchups').del()
    await knex('playoffs').del()
    await knex('league_team_seasonlogs').del()
    await knex('seasons')
      .where({ lid: LEAGUE_ID, season_year: current_season.year })
      .update({
        ...ALL_PLAY_BYE_FORMAT,
        wildcard_round: WILDCARD_WEEK,
        championship_round: CHAMPIONSHIP_WEEKS
      })
  })

  it('awards byes on the configured ladder, not on the recorded finish', async function () {
    // The finish column here ranks the league on RECORD, which is what a stale
    // standings run leaves behind. Reading it awards the byes to teams 1 and 2;
    // the format awards them to 5 and 6.
    await seed_seasonlogs({
      finish_by_tid: Object.fromEntries(
        STANDINGS.map((team, index) => [team.tid, index + 1])
      )
    })
    await seed_playoff_field({ tids: EXPECTED_FIELD_TIDS })

    const forecast = await run()

    for (const tid of EXPECTED_BYE_TIDS) {
      expect(forecast[tid].bye_odds, `team ${tid} bye_odds`).to.equal(1)
    }
    for (const tid of TEAM_IDS.filter(
      (team_id) => !EXPECTED_BYE_TIDS.includes(team_id)
    )) {
      expect(forecast[tid].bye_odds, `team ${tid} bye_odds`).to.equal(0)
    }
  })

  it('still awards byes when no standings finish has been written', async function () {
    // regular_season_finish is nullable with no default, so this is the state
    // between the last game and the standings run. Under the defect every team
    // took a 0 here and the whole field played the wildcard round.
    await seed_seasonlogs({})
    await seed_playoff_field({ tids: EXPECTED_FIELD_TIDS })

    const forecast = await run()

    const bye_tids = TEAM_IDS.filter((tid) => forecast[tid].bye_odds === 1)
    expect(bye_tids).to.eql(EXPECTED_BYE_TIDS)
  })

  it('reports the recorded field on playoff odds and simulates the championship', async function () {
    await seed_seasonlogs({})
    await seed_playoff_field({ tids: EXPECTED_FIELD_TIDS })

    const forecast = await run()

    for (const tid of TEAM_IDS) {
      expect(forecast[tid].playoff_odds, `team ${tid} playoff_odds`).to.equal(
        EXPECTED_FIELD_TIDS.includes(tid) ? 1 : 0
      )
    }

    // Championship odds are simulated over the field rather than left at zero,
    // and only the field can win.
    const total = TEAM_IDS.reduce(
      (sum, tid) => sum + forecast[tid].championship_odds,
      0
    )
    expect(total).to.be.closeTo(1, 1e-9)
    for (const tid of TEAM_IDS.filter(
      (team_id) => !EXPECTED_FIELD_TIDS.includes(team_id)
    )) {
      expect(forecast[tid].championship_odds).to.equal(0)
    }
  })

  it('refuses a recorded field that omits a team the seeding puts on a bye', async function () {
    // process-playoffs and process-matchups write these two tables, so they can
    // disagree when one ran on stale data. A bye team outside the field would
    // otherwise be promoted straight into the championship round and shorten
    // the wildcard round by one, with no sign in the output.
    await seed_seasonlogs({})
    await seed_playoff_field({ tids: [1, 2, 3, 4, 7, 8] })

    let error = null
    try {
      await run()
    } catch (err) {
      error = err
    }

    expect(
      error,
      'a field disagreeing with the seeding was accepted'
    ).to.not.equal(null)
    expect(error.message).to.match(
      /seeds team\(s\) 5, 6 on a bye .* the recorded playoff field does not include them/
    )
  })
})
