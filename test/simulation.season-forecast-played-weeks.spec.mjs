/* global describe before beforeEach it */
import * as chai from 'chai'

import knex from '#db'
import { current_season } from '#constants'
import { load_forecast_context } from '#libs-server/simulation/simulate-season-forecast.mjs'
import league_fixture from '#db/fixtures/league.mjs'

process.env.NODE_ENV = 'test'

const expect = chai.expect

// `load_forecast_context` decides which weeks the historical-mode forecast
// treats as already played. Getting it wrong does not throw -- it hands the
// simulation a set of starting standings that were never earned, and every
// odds number downstream is computed from them.
//
// The naive test is a `whereNotNull` on the points columns, and it cannot work
// here: `matchups.home_points` and `away_points` are declared NOT NULL DEFAULT
// 0.00, so the schedule is written ahead of the season as a full slate of 0-0
// rows and scored in place. There is no null to filter, in this league or in
// any season the database holds. That test qualifies every unplayed week
// instead of excluding it, and the forecast starts from a season of ties.
//
// A per-matchup `points > 0` test is not the fix either: it would drop a
// genuine 0-0 game out of a week that WAS played, reporting a partial week.
// The oracle is per week -- some team in the week scored above zero, and then
// every matchup in it counts, including a real 0-0.
const LEAGUE_ID = 1
const TEAM_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
const PAIRS = [
  [1, 2],
  [3, 4],
  [5, 6],
  [7, 8],
  [9, 10],
  [11, 12]
]
const FORECAST_FROM_WEEK = 5

/**
 * Write one week of the schedule. `scores_by_team_id` omitted writes the
 * unplayed shape: every row at the 0.00 column default.
 */
const seed_week = async ({ week, scores_by_team_id = null }) =>
  knex('matchups').insert(
    PAIRS.map(([home_team_id, away_team_id], index) => ({
      matchup_id: week * 100 + index,
      lid: LEAGUE_ID,
      season_year: current_season.year,
      week,
      home_team_id,
      away_team_id,
      home_points: scores_by_team_id ? scores_by_team_id[home_team_id] : 0,
      away_points: scores_by_team_id ? scores_by_team_id[away_team_id] : 0
    }))
  )

const load = () =>
  load_forecast_context({
    league_id: LEAGUE_ID,
    year: current_season.year,
    current_week: FORECAST_FROM_WEEK,
    week: FORECAST_FROM_WEEK,
    regular_season_final_week: current_season.regular_season_final_week
  })

// Odd team ids win, even team ids lose, and the margin rises with the team id
// so All Play is not a constant either.
const decisive_scores = ({ base }) =>
  Object.fromEntries(
    TEAM_IDS.map((team_id) => [
      team_id,
      team_id % 2 === 1 ? base + team_id * 3 : base - team_id
    ])
  )

describe('SIMULATION season forecast played weeks', function () {
  this.timeout(60 * 1000)

  before(async function () {
    await knex.seed.run()
  })

  beforeEach(async function () {
    await league_fixture(knex)
    await knex('matchups').del()
  })

  it('counts no games when every prior week is an unplayed all-zero slate', async function () {
    // Exactly what the 2026 schedule looked like on the day this was found:
    // seventy rows, none null, not one game played.
    for (const week of [1, 2, 3, 4]) {
      await seed_week({ week })
    }

    const { team_stats_by_tid } = await load()

    for (const team_id of TEAM_IDS) {
      const stats = team_stats_by_tid[team_id]
      // Under the defect every one of these is 4: four weeks of 0-0 ties.
      expect(stats.regular_season_ties, `team ${team_id} ties`).to.equal(0)
      expect(stats.regular_season_wins, `team ${team_id} wins`).to.equal(0)
      expect(stats.regular_season_losses, `team ${team_id} losses`).to.equal(0)
      expect(stats.points_for, `team ${team_id} points_for`).to.equal(0)
      expect(stats.all_play_ties, `team ${team_id} all play ties`).to.equal(0)
    }
  })

  it('counts only the played weeks when unplayed ones sit behind them', async function () {
    const week_one = decisive_scores({ base: 100 })
    const week_two = decisive_scores({ base: 120 })

    await seed_week({ week: 1, scores_by_team_id: week_one })
    await seed_week({ week: 2, scores_by_team_id: week_two })
    await seed_week({ week: 3 })
    await seed_week({ week: 4 })

    const { team_stats_by_tid } = await load()

    for (const team_id of TEAM_IDS) {
      const stats = team_stats_by_tid[team_id]
      const decisions =
        stats.regular_season_wins +
        stats.regular_season_losses +
        stats.regular_season_ties

      // Two, not four. The two unplayed weeks must not add ties.
      expect(decisions, `team ${team_id} games`).to.equal(2)
      expect(stats.points_for, `team ${team_id} points_for`).to.equal(
        week_one[team_id] + week_two[team_id]
      )

      // Eleven All Play meetings a week over two played weeks, and none of
      // them a tie -- the unplayed weeks would have contributed 22 ties.
      const all_play =
        stats.all_play_wins + stats.all_play_losses + stats.all_play_ties
      expect(all_play, `team ${team_id} all play games`).to.equal(22)
      expect(stats.all_play_ties, `team ${team_id} all play ties`).to.equal(0)
    }

    expect(team_stats_by_tid[11].regular_season_wins).to.equal(2)
    expect(team_stats_by_tid[12].regular_season_losses).to.equal(2)
  })

  it('keeps a real 0-0 game inside a week that some other team played', async function () {
    // The control on the per-matchup shortcut. Teams 1 and 2 both scored zero
    // in a week that was unambiguously played, so their game is a tie and
    // their All Play record still runs against the other ten teams.
    const scores = decisive_scores({ base: 100 })
    scores[1] = 0
    scores[2] = 0

    await seed_week({ week: 1, scores_by_team_id: scores })

    const { team_stats_by_tid } = await load()

    expect(team_stats_by_tid[1].regular_season_ties).to.equal(1)
    expect(team_stats_by_tid[2].regular_season_ties).to.equal(1)
    expect(team_stats_by_tid[1].points_for).to.equal(0)

    // Ten losses and one tie: last in the league, but present in the week.
    expect(team_stats_by_tid[1].all_play_losses).to.equal(10)
    expect(team_stats_by_tid[1].all_play_ties).to.equal(1)

    for (const team_id of TEAM_IDS) {
      const stats = team_stats_by_tid[team_id]
      const all_play =
        stats.all_play_wins + stats.all_play_losses + stats.all_play_ties
      expect(all_play, `team ${team_id} all play games`).to.equal(11)
    }
  })

  it('ranks the tallied standings so the forecast has a finish to read', async function () {
    await seed_week({
      week: 1,
      scores_by_team_id: decisive_scores({ base: 100 })
    })

    const { team_stats_by_tid } = await load()

    const finishes = TEAM_IDS.map(
      (team_id) => team_stats_by_tid[team_id].regular_season_finish
    ).sort((a, b) => a - b)

    expect(finishes).to.eql(TEAM_IDS)
  })
})
