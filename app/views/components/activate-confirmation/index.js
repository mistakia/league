import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { rosterActions } from '@core/rosters'
import { getCurrentPlayers } from '@core/selectors'

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
