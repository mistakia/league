import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { constants, calculatePoints } from '@common'
import { getPlayerGamelogs, getGamelogs } from '@core/gamelogs'
import { getSelectedPlayer, getSelectedPlayerGame } from '@core/players'
import { getCurrentLeague } from '@core/leagues'

import SelectedPlayerMatchupTable from './selected-player-matchup-table'

const mapStateToProps = createSelector(
  getSelectedPlayer,
  getSelectedPlayerGame,
  getPlayerGamelogs,
  getCurrentLeague,
  getGamelogs,
  (playerMap, game, logs, league, gamelogState) => {
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

    const defense = gamelogState.getIn(['playersAnalysis', 'defense'], {})
    const dPos = defense[position]

    const defenseStats = []
    if (dPos) {
      const types = { avg: 'Average', adj: 'Over Expected' }
      for (const [type, title] of Object.entries(types)) {
        const stats = dPos.stats[type].find((d) => d.opp === opp)
        const points = calculatePoints({ stats, position, league })
        defenseStats.push({
          type,
          stats,
          points: points.total,
          title
        })
      }
    }

    const individual = gamelogState.getIn(['playersAnalysis', 'individual'], {})

    return {
      gamelogs,
      defenseStats,
      playerPercentiles: individual ? individual[position] : {},
      defensePercentiles: dPos ? dPos.percentiles : {},
      opp,
      position
    }
  }
)

export default connect(mapStateToProps)(SelectedPlayerMatchupTable)
