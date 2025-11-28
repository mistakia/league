import { connect } from 'react-redux'
import { createSelector } from 'reselect'
import { Map } from 'immutable'

import { team_actions } from '@core/teams'
import { current_season } from '@constants'
import {
  get_app,
  get_current_league,
  get_teams_for_current_league_and_year,
  get_league_user_historical_ranks
} from '@core/selectors'
import { league_careerlogs_actions } from '@core/league-careerlogs'
import { calculatePercentiles } from '@libs-shared'

import StatsPage from './stats'

const map_state_to_props = createSelector(
  get_current_league,
  get_teams_for_current_league_and_year,
  get_app,
  get_league_user_historical_ranks,
  (league, teams, app, league_user_historical_ranks) => {
    // calculate the all play win percentage
    teams = teams.map((team) => {
      const wins = team.getIn(['stats', 'apWins'], 0)
      const losses = team.getIn(['stats', 'apLosses'], 0)
      const ties = team.getIn(['stats', 'apTies'], 0)
      const total = wins + losses + ties
      const all_play_win_pct = total > 0 ? (wins / total) * 100 : 0
      return team.setIn(['stats', 'all_play_win_pct'], all_play_win_pct)
    })

    const default_team_stats = new Map({
      ...current_season.createFantasyTeamStats(),
      all_play_win_pct: 0
    })
    const year = app.year
    // TODO - add prefix
    const percentiles = calculatePercentiles({
      items: teams
        .map((t) => t.get('stats', default_team_stats))
        .toList()
        .toJS(),
      stats: [...current_season.fantasyTeamStats, 'all_play_win_pct']
    })

    const careerlog_fields = [
      'wins',
      'losses',
      'ties',
      'apWins',
      'apLosses',
      'apTies',
      'pf',
      'pa',
      'pdiff',
      'pp',
      'pw',
      'pl',
      'pp_pct',
      'pmax',
      'pmin',
      'weekly_high_scores',
      'post_seasons',
      'championships',
      'championship_rounds',
      'regular_season_leader',
      'num_byes',
      'best_season_win_pct',
      'best_season_all_play_pct',
      'wildcards',
      'wildcard_wins',
      'wildcard_highest_score',
      'wildcard_total_points',
      'wildcard_lowest_score',
      'championship_highest_score',
      'championship_total_points',
      'championship_lowest_score',
      'worst_regular_season_finish',
      'best_regular_season_finish',
      'best_overall_finish',
      'worst_overall_finish',
      'division_wins'
    ]

    const sorted_league_user_historical_ranks = Object.values(
      league_user_historical_ranks
    ).sort((a, b) => b.wins - a.wins)

    const careerlog_percentiles = calculatePercentiles({
      items: sorted_league_user_historical_ranks,
      stats: careerlog_fields
    })

    return {
      league,
      teams,
      percentiles,
      year,
      league_user_historical_ranks: sorted_league_user_historical_ranks,
      careerlog_percentiles
    }
  }
)

const map_dispatch_to_props = {
  load_league_team_stats: team_actions.load_league_team_stats,
  load_league_careerlogs: league_careerlogs_actions.load_league_careerlogs
}

export default connect(map_state_to_props, map_dispatch_to_props)(StatsPage)
