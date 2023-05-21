import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getCurrentPlayers } from '@core/selectors'
import { rosterActions } from '@core/rosters'
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
