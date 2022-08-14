import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { rosterActions, getCurrentPlayers } from '@core/rosters'

import DeactivateConfirmation from './deactivate-confirmation'

const mapStateToProps = createSelector(getCurrentPlayers, (team) => ({
  team
}))

const mapDispatchToProps = {
  deactivate: rosterActions.deactivate
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(DeactivateConfirmation)
