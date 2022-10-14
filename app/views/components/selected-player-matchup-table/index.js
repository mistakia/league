import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { constants, calculatePoints } from '@common'
import { getPlayerGamelogs, getGamelogs } from '@core/gamelogs'
import { getSelectedPlayer, getSelectedPlayerGame } from '@core/players'
import { getCurrentLeague } from '@core/leagues'
import { getSeasonlogs } from '@core/seasonlogs'

import SelectedPlayerMatchupTable from './selected-player-matchup-table'

const mapStateToProps = createSelector(
  getSelectedPlayer,
  getSelectedPlayerGame,
  getPlayerGamelogs,
  getCurrentLeague,
  getGamelogs,
  getSeasonlogs,
  (playerMap, game, logs, league, gamelogState, seasonlogs) => {
    if (!game) {
      return {}
    }
    const opp = playerMap.get('team') === game.h ? game.v : game.h
    const position = playerMap.get('pos')
    const gamelogs = logs
      .filter(
        (g) =>
          g.year === constants.season.year &&
          g.opp === opp &&
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
    const types = { avg: 'Average', adj: 'Over Expected' }
    for (const [type, title] of Object.entries(types)) {
      const stat_key = `${position}_against_${type}`.toUpperCase()
      const stats = seasonlogs.getIn(['nfl_teams', opp, stat_key])
      if (stats) {
        nfl_team_against_seasonlogs.push({
          type,
          stats,
          title
        })
      }
    }

    return {
      gamelogs,
      nfl_team_against_seasonlogs,
      opp,
      position
    }
  }
)

export default connect(mapStateToProps)(SelectedPlayerMatchupTable)
