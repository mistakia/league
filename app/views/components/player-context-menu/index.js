import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { contextMenuActions, getContextMenuPlayer } from '@core/context-menu'
import { rosterActions } from '@core/rosters'
import { confirmationActions } from '@core/confirmations'
import { waiverActions } from '@core/waivers'
import { getPlayerStatus } from '@core/players'

import PlayerContextMenu from './player-context-menu'

const mapStateToProps = createSelector(
  getContextMenuPlayer,
  getPlayerStatus,
  (player, status) => ({
    player,
    status
  })
)

const mapDispatchToProps = {
  showContext: contextMenuActions.show,
  hide: contextMenuActions.hide,
  activate: rosterActions.activate,
  deactivate: rosterActions.deactivate,
  showConfirmation: confirmationActions.show,
  cancelClaim: waiverActions.cancel,
  reserve: rosterActions.reserve,
  release: rosterActions.release,
  protect: rosterActions.protect
}

export default connect(mapStateToProps, mapDispatchToProps)(PlayerContextMenu)
