import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { calculatePoints } from '@common'
import { getPlayerGamelogs, getGamelogs } from '@core/gamelogs'
import { getSelectedPlayer, getSelectedPlayerGame } from '@core/players'
import { getCurrentLeague } from '@core/leagues'

import SelectedPlayerMatchup from './selected-player-matchup'

const mapStateToProps = createSelector(
  getSelectedPlayer,
  getSelectedPlayerGame,
  getPlayerGamelogs,
  getCurrentLeague,
  getGamelogs,
  (player, game, logs, league, gamelogState) => {
    if (!game) {
      return {}
    }

    const opp = player.team === game.h ? game.v : game.h
    const gamelogs = logs
      .filter((g) => g.opp === opp && g.pos === player.pos)
      .sort((a, b) => a.week - b.week)
      .withMutations((g) => {
        for (const [index, gamelog] of g.entrySeq()) {
          const points = calculatePoints({
            stats: gamelog,
            position: player.pos,
            league
          })
          g.setIn([index, 'pts'], points.total)
        }
      })

    const defense = gamelogState.getIn(['playersAnalysis', 'defense'], {})
    const dPos = defense[player.pos]

    const defenseStats = []
    if (dPos) {
      const types = { total: 'Total', adj: 'Adjusted', avg: 'Average' }
      for (const [type, title] of Object.entries(types)) {
        const stats = dPos.stats[type].find((d) => d.opp === opp)
        const points = calculatePoints({ stats, position: player.pos, league })
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
      player,
      gamelogs,
      defenseStats,
      playerPercentiles: individual ? individual[player.pos] : {},
      defensePercentiles: dPos ? dPos.percentiles : {},
      opp
    }
  }
)

export default connect(mapStateToProps)(SelectedPlayerMatchup)
