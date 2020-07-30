import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import {
  getContextMenuInfo,
  contextMenuActions,
  getContextMenuPlayer
} from '@core/context-menu'
import RosterContextMenu from './roster-context-menu'
import {
  isPracticeSquadEligible,
  isActiveRosterEligible,
  rosterActions
} from '@core/rosters'

const mapStateToProps = createSelector(
  getContextMenuInfo,
  getContextMenuPlayer,
  isPracticeSquadEligible,
  isActiveRosterEligible,
  (contextMenuInfo, player, isPracticeSquadEligible, isActiveRosterEligible) => ({
    contextMenuInfo,
    player,
    isPracticeSquadEligible,
    isActiveRosterEligible
  })
)

const mapDispatchToProps = {
  showContext: contextMenuActions.show,
  hide: contextMenuActions.hide,
  activate: rosterActions.activate,
  deactivate: rosterActions.deactivate
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(RosterContextMenu)
