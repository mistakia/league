import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { rosterActions, getCurrentPlayers } from '@core/rosters'

import ActivateConfirmation from './activate-confirmation'

const mapStateToProps = createSelector(getCurrentPlayers, (team) => ({
  team
}))

const mapDispatchToProps = {
  activate: rosterActions.activate
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(ActivateConfirmation)
