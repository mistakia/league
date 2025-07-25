import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { constants, calculatePoints } from '@libs-shared'
import {
  get_current_league,
  getSelectedPlayer,
  getSelectedPlayerGame,
  get_player_gamelogs,
  get_gamelogs_state,
  get_seasonlogs,
  get_app
} from '@core/selectors'
import { gamelogs_actions } from '@core/gamelogs'
import { percentile_actions } from '@core/percentiles'

import SelectedPlayerMatchupTable from './selected-player-matchup-table'

const map_state_to_props = createSelector(
  getSelectedPlayer,
  getSelectedPlayerGame,
  get_player_gamelogs,
  get_current_league,
  get_gamelogs_state,
  get_seasonlogs,
  get_app,
  (playerMap, game, logs, league, gamelogState, seasonlogs, app) => {
    if (!game) {
      return {}
    }
    const opponent = playerMap.get('team') === game.h ? game.v : game.h
    const position = playerMap.get('pos')
    const gamelogs = logs
      .filter(
        (g) =>
          g.year === constants.season.year &&
          g.opp === opponent &&
          g.pos === position
      )
      .sort((a, b) => a.week - b.week)
      .withMutations((g) => {
        for (const [index, gamelog] of g.entrySeq()) {
          const points = calculatePoints({
            stats: gamelog,
            position,
            league
          })
          g.setIn([index, 'pts'], points.total)
        }
      })

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
      gamelogs,
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
