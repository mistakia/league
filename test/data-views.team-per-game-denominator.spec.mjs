/* global describe it */

import * as chai from 'chai'

import { get_data_view_results_query } from '#libs-server'

const expect = chai.expect

// Regression for /u/f9bfd706be9d7f4438195a671eb0353c (team_pass_attempts_from_plays
// per_game over a 3-year window, no year split). add_team_per_game_cte previously
// grouped the nfl_games denominator by ['team','year'] UNCONDITIONALLY, while
// join_team_per_game_cte only correlates on year when a year split is active. With
// no split the join fanned the denominator into one row per (team, year) and the
// outer MAX() collapsed it to a single season's game count (~17) -- while the
// numerator is the full multi-year total -- inflating every team per-game rate by
// ~N (N = years in the window, here ~3x). The denominator must partition by year
// ONLY when a year split is active, matching the player per-game denominator and
// build-period-cte's `include_year` invariant.

const team_per_game_request = ({ year, row_axes = [] }) => ({
  columns: [
    {
      column_id: 'team_pass_attempts_from_plays',
      params: {
        year,
        output: { period: 'game', aggregation: 'rate', threshold: null }
      }
    }
  ],
  sort: [],
  where: [],
  row_axes
})

describe('data-views team per-game denominator grain', () => {
  it('groups the nfl_games denominator by team only on a multi-year query with NO year split', async () => {
    const { query } = await get_data_view_results_query(
      team_per_game_request({ year: [2023, 2024, 2025] })
    )
    const sql = query.toString()

    // home/away sides project team only -- no per-year partition
    expect(sql).to.match(/select "h" as "team" from "nfl_games"/)
    expect(sql).to.match(/select "v" as "team" from "nfl_games"/)
    // and crucially do NOT carry year into the union (the bug shape)
    expect(sql).to.not.match(/select "h" as "team", "year" from "nfl_games"/)
    // the denominator collapses to one row per team (full-window game count)
    expect(sql).to.match(/group by "team"(?!, "year")/)
  })

  it('partitions the nfl_games denominator by (team, year) when a year split IS active', async () => {
    const { query } = await get_data_view_results_query(
      team_per_game_request({ year: [2023, 2024, 2025], row_axes: ['year'] })
    )
    const sql = query.toString()

    // under a year split the union must carry year so the join correlates 1:1
    expect(sql).to.match(/select "h" as "team", "year" from "nfl_games"/)
    expect(sql).to.match(/group by "team", "year"/)
  })

  // Regression for trap #2: the numerator (aggregator-rate) projects the team
  // through the player_year->team_year bridge (player_year_teams.team), but the
  // per_game denominator join previously hardcoded player.current_nfl_team -- so
  // for an offseason team-changer the volume and games came from DIFFERENT teams,
  // and free agents (current_nfl_team='INA', no nfl_games row) lost the column.
  // Both halves must now project onto player_year_teams.team via the SAME shared
  // resolver.
  it('joins the per_game denominator on the SAME bridge team as the numerator (not current_nfl_team)', async () => {
    const { query } = await get_data_view_results_query(
      team_per_game_request({ year: [2023, 2024, 2025] })
    )
    const sql = query.toString()

    // numerator (rate aggregate) projects via the bridge -- "...team_code" = player_year_teams.team
    expect(sql).to.match(/"team_code" = "player_year_teams"\."team"/)
    // denominator (games CTE) now projects via the SAME bridge -- "...team" = player_year_teams.team
    expect(sql).to.match(/"team" = "player_year_teams"\."team"/)
    // and crucially NO LONGER joins the denominator on player.current_nfl_team
    expect(sql).to.not.match(/"team" = "player"\."current_nfl_team"/)
  })
})
