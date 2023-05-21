import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { contextMenuActions } from '@core/context-menu'
import { rosterActions } from '@core/rosters'
import { confirmationActions } from '@core/confirmations'
import { waiverActions } from '@core/waivers'
import { playerActions } from '@core/players'
import { getPlayerStatus, getPlayers, getPlayerById } from '@core/selectors'

import PlayerContextMenu from './player-context-menu'

const mapStateToProps = createSelector(
  getPlayerById,
  getPlayerStatus,
  getPlayers,
  (playerMap, status, players) => ({
    playerMap,
    status,
    isOnCutlist: players.get('cutlist').includes(playerMap.get('pid'))
  })
)

const mapDispatchToProps = {
  showContext: contextMenuActions.show,
  hide: contextMenuActions.hide,
  showConfirmation: confirmationActions.show,
  cancelClaim: waiverActions.cancel,
  reserve: rosterActions.reserve,
  release: rosterActions.release,
  protect: rosterActions.protect,
  toggleCutlist: playerActions.toggleCutlist
}

export default connect(mapStateToProps, mapDispatchToProps)(PlayerContextMenu)
