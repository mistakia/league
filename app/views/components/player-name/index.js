import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getPlayerById, getPlayers } from '@core/selectors'
import { playerActions } from '@core/players'

import PlayerName from './player-name'

const mapStateToProps = createSelector(
  getPlayerById,
  getPlayers,
  (playerMap, players) => ({
    playerMap,
    isOnCutlist: players.get('cutlist').includes(playerMap.get('pid'))
  })
)

const mapDispatchToProps = {
  select: playerActions.selectPlayer
}

export default connect(mapStateToProps, mapDispatchToProps)(PlayerName)
