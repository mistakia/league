import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import {
  getContextMenuInfo,
  contextMenuActions,
  getContextMenuPlayer,
  isPracticeSquadEligible,
  isActiveRosterEligible,
  isPlayerOnCurrentRoster
} from '@core/context-menu'
import PlayerContextMenu from './player-context-menu'
import { rosterActions } from '@core/rosters'
import { confirmationActions } from '@core/confirmations'

const mapStateToProps = createSelector(
  getContextMenuInfo,
  getContextMenuPlayer,
  isPracticeSquadEligible,
  isActiveRosterEligible,
  isPlayerOnCurrentRoster,
  (contextMenuInfo, player, isPracticeSquadEligible, isActiveRosterEligible, isOnCurrentRoster) => ({
    contextMenuInfo,
    player,
    isPracticeSquadEligible,
    isOnCurrentRoster,
    isActiveRosterEligible
  })
)

const mapDispatchToProps = {
  showContext: contextMenuActions.show,
  hide: contextMenuActions.hide,
  activate: rosterActions.activate,
  deactivate: rosterActions.deactivate,
  showConfirmation: confirmationActions.show
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(PlayerContextMenu)
