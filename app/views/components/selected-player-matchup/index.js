import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { calculatePoints } from '@common'
import { getGamelogs } from '@core/gamelogs'
import { getSelectedPlayer, getSelectedPlayerGame } from '@core/players'
import { getCurrentLeague } from '@core/leagues'

import SelectedPlayerMatchup from './selected-player-matchup'

const mapStateToProps = createSelector(
  getSelectedPlayer,
  getSelectedPlayerGame,
  getGamelogs,
  getCurrentLeague,
  (player, game, logs, league) => {
    if (!game) {
      return {}
    }

    const opp = player.team === game.h ? game.v : game.h
    const gamelogs = logs
      .filter(g => g.opp === opp && g.pos === player.pos1)
      .sort((a, b) => a.week - b.week)
      .withMutations(g => {
        for (const [index, gamelog] of g.entrySeq()) {
          const points = calculatePoints({ stats: gamelog, position: player.pos1, league })
          g.setIn([index, 'pts'], points.total)
        }
      })

    return {
      player,
      gamelogs,
      opp
    }
  }
)

export default connect(
  mapStateToProps
)(SelectedPlayerMatchup)
