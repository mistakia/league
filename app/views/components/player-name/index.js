import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getPlayerById, playerActions, getPlayers } from '@core/players'

import PlayerName from './player-name'

const mapStateToProps = createSelector(
  getPlayerById,
  getPlayers,
  (player, players) => ({
    player,
    isOnCutlist: players.get('cutlist').includes(player.player)
  })
)

const mapDispatchToProps = {
  select: playerActions.selectPlayer
}

export default connect(mapStateToProps, mapDispatchToProps)(PlayerName)
