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
import { hasDraftClockExpired } from '@core/draft'
import { hasAuctionCompleted } from '@core/auction'

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
  hasDraftClockExpired,
  hasAuctionCompleted,
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
    hasDraftClockExpired,
    hasAuctionCompleted,
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
    hasDraftClockExpired,
    hasAuctionCompleted,
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
