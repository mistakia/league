import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { rosterActions, getCurrentPlayers } from '@core/rosters'
import { playerActions } from '@core/players'

import DeactivateConfirmation from './deactivate-confirmation'

const mapStateToProps = createSelector(getCurrentPlayers, (team) => ({
  team
}))

const mapDispatchToProps = {
  deactivate: rosterActions.deactivate,
  loadPlayerTransactions: playerActions.getPlayerTransactions
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(DeactivateConfirmation)
