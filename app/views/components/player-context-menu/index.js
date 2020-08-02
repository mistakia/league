import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import {
  getContextMenuInfo,
  contextMenuActions,
  getContextMenuPlayer,
  isActiveRosterEligible,
  isPlayerOnCurrentRoster,
  isPlayerRostered,
  isPlayerPracticeSquadEligibleCM,
  getPlayerStatusCM,
  isPlayerOnPracticeSquadCM
} from '@core/context-menu'
import { rosterActions } from '@core/rosters'
import { confirmationActions } from '@core/confirmations'
import { waiverActions } from '@core/waivers'

import PlayerContextMenu from './player-context-menu'

const mapStateToProps = createSelector(
  getContextMenuInfo,
  getContextMenuPlayer,
  isPlayerPracticeSquadEligibleCM,
  isActiveRosterEligible,
  isPlayerOnCurrentRoster,
  isPlayerRostered,
  getPlayerStatusCM,
  isPlayerOnPracticeSquadCM,
  (
    contextMenuInfo,
    player,
    isPracticeSquadEligible,
    isActiveRosterEligible,
    isOnCurrentRoster,
    isPlayerRostered,
    status,
    isPlayerOnPracticeSquad
  ) => ({
    contextMenuInfo,
    player,
    isPracticeSquadEligible,
    isOnCurrentRoster,
    isActiveRosterEligible,
    isPlayerRostered,
    status,
    isPlayerOnPracticeSquad
  })
)

const mapDispatchToProps = {
  showContext: contextMenuActions.show,
  hide: contextMenuActions.hide,
  activate: rosterActions.activate,
  deactivate: rosterActions.deactivate,
  showConfirmation: confirmationActions.show,
  cancelClaim: waiverActions.cancel
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(PlayerContextMenu)
