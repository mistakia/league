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
  isPlayerOnPracticeSquadCM,
  hasExistingPoachingClaim
} from '@core/context-menu'
import { rosterActions, getCurrentTeamRoster } from '@core/rosters'
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
  hasExistingPoachingClaim,
  getCurrentTeamRoster,
  (
    contextMenuInfo,
    player,
    isPracticeSquadEligible,
    isActiveRosterEligible,
    isOnCurrentRoster,
    isPlayerRostered,
    status,
    isPlayerOnPracticeSquad,
    hasExistingPoachingClaim,
    roster
  ) => ({
    contextMenuInfo,
    player,
    isPracticeSquadEligible,
    isOnCurrentRoster,
    isActiveRosterEligible,
    isPlayerRostered,
    status,
    isPlayerOnPracticeSquad,
    hasExistingPoachingClaim,
    isPlayerEligibleToDeactivate: isPracticeSquadEligible && roster.hasOpenPracticeSquadSlot()
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
