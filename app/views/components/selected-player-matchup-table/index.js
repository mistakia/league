import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { calculatePoints } from '@libs-shared'
import {
  get_current_league,
  getSelectedPlayer,
  getSelectedPlayerGame,
  get_player_gamelogs,
  get_seasonlogs,
  get_app
} from '@core/selectors'
import { gamelogs_actions } from '@core/gamelogs'
import { percentile_actions } from '@core/percentiles'

import SelectedPlayerMatchupTable from './selected-player-matchup-table'

const get_filtered_gamelogs_for_schedule = createSelector(
  [
    get_player_gamelogs,
    getSelectedPlayer,
    getSelectedPlayerGame,
    get_current_league,
    (_, props) => props.selected_years,
    (_, props) => props.selected_weeks
  ],
  (
    logs,
    player_map,
    game,
    league,
    selected_years_for_filter,
    selected_weeks_for_filter
  ) => {
    if (!game || !player_map) {
      return []
    }

    const opponent = player_map.get('team') === game.h ? game.v : game.h
    const position = player_map.get('pos')

    return logs
      .filter((gamelog) => {
        // Filter by opponent and position
        if (gamelog.opp !== opponent || gamelog.pos !== position) {
          return false
        }

        // Filter by selected years
        if (
          selected_years_for_filter.length > 0 &&
          !selected_years_for_filter.includes(gamelog.year)
        ) {
          return false
        }

        // Filter by selected weeks (empty array means all weeks)
        if (
          selected_weeks_for_filter.length > 0 &&
          !selected_weeks_for_filter.includes(gamelog.week)
        ) {
          return false
        }

        return true
      })
      .sort((a, b) => {
        // Sort by year first, then by week
        if (a.year !== b.year) {
          return b.year - a.year // Newest year first
        }
        return a.week - b.week // Earliest week first within year
      })
      .withMutations((filtered_gamelogs) => {
        for (const [index, gamelog] of filtered_gamelogs.entrySeq()) {
          const points = calculatePoints({
            stats: gamelog,
            position,
            league
          })
          filtered_gamelogs.setIn([index, 'pts'], points.total)
        }
      })
  }
)

const map_state_to_props = createSelector(
  getSelectedPlayer,
  getSelectedPlayerGame,
  get_seasonlogs,
  get_app,
  get_filtered_gamelogs_for_schedule,
  (player_map, game, seasonlogs, app, filtered_gamelogs) => {
    if (!game) {
      return {}
    }
    const opponent = player_map.get('team') === game.h ? game.v : game.h
    const position = player_map.get('pos')

    const nfl_team_against_seasonlogs = []
    const types = { avg: 'Average', adj: 'Over Average' }
    for (const [type, title] of Object.entries(types)) {
      const stat_key = `${position}_against_${type}`.toUpperCase()
      const stats = seasonlogs.getIn(['nfl_teams', opponent, stat_key])
      if (stats) {
        nfl_team_against_seasonlogs.push({
          type,
          percentile_key: stat_key,
          stats,
          title
        })
      }
    }

    return {
      gamelogs: filtered_gamelogs,
      nfl_team_against_seasonlogs,
      opponent,
      position,
      year: app.year
    }
  }
)

const map_dispatch_to_props = {
  load_percentiles: percentile_actions.load_percentiles,
  load_players_gamelogs: gamelogs_actions.load_players_gamelogs
}

export default connect(
  map_state_to_props,
  map_dispatch_to_props
)(SelectedPlayerMatchupTable)
