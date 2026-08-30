import { calculate_week_all_play_records } from '#libs-shared/calculate-week-all-play-records.mjs'

/**
 * Apply one simulated week to the standings, deriving every measure the playoff
 * ladder reads from the SAME scores.
 *
 * That is the whole point of the function existing. The forecast previously
 * drew a head-to-head outcome from a win probability while copying points_for
 * and All Play from actuals and never moving them, so three measures the format
 * reads came from three different places and only one of them varied. Here the
 * matchup result, the points scored and the All Play record are all consequences
 * of one draw, so they cannot disagree.
 *
 * Mutates `standings` in place, matching the loop it is called from.
 *
 * @param {object} params
 * @param {Record<number, object>} params.standings - Standings keyed by team id,
 *   carrying the keys compare_playoff_seed and compare_all_play_seed read
 * @param {object[]} params.week_matchups - The week's matchups
 * @param {Map<number, number>} params.scores_by_team_id - This week's score per team
 */
export const accumulate_simulated_week_standings = ({
  standings,
  week_matchups,
  scores_by_team_id
}) => {
  for (const [team_id, score] of scores_by_team_id) {
    const team_standings = standings[team_id]
    if (!team_standings) {
      throw new Error(
        `simulated score for team ${team_id}, which is not in the standings being accumulated`
      )
    }
    team_standings.points_for += score
  }

  for (const matchup of week_matchups) {
    const home_standings = standings[matchup.home_team_id]
    const away_standings = standings[matchup.away_team_id]

    if (!home_standings || !away_standings) {
      throw new Error(
        `matchup ${matchup.matchup_id} names a team absent from the standings: home ${matchup.home_team_id}, away ${matchup.away_team_id}`
      )
    }

    const home_score = scores_by_team_id.get(matchup.home_team_id)
    const away_score = scores_by_team_id.get(matchup.away_team_id)

    if (home_score === undefined || away_score === undefined) {
      throw new Error(
        `matchup ${matchup.matchup_id} has no simulated score for home ${matchup.home_team_id} or away ${matchup.away_team_id}, leaving both teams a game short of the rest of the league`
      )
    }

    if (home_score > away_score) {
      home_standings.regular_season_wins++
      away_standings.regular_season_losses++
    } else if (away_score > home_score) {
      away_standings.regular_season_wins++
      home_standings.regular_season_losses++
    } else {
      home_standings.regular_season_ties++
      away_standings.regular_season_ties++
    }
  }

  const all_play_records = calculate_week_all_play_records({
    scores_by_team_id
  })

  for (const [team_id, record] of all_play_records) {
    const team_standings = standings[team_id]
    team_standings.all_play_wins += record.all_play_wins
    team_standings.all_play_losses += record.all_play_losses
    team_standings.all_play_ties += record.all_play_ties
  }
}

export default accumulate_simulated_week_standings
