import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getCurrentPlayers } from '@core/selectors'
import { roster_actions } from '@core/rosters'
import { player_actions } from '@core/players'

import DeactivateConfirmation from './deactivate-confirmation'

const mapStateToProps = createSelector(getCurrentPlayers, (team) => ({
  team
}))

const mapDispatchToProps = {
  deactivate: roster_actions.deactivate,
  load_player_transactions: player_actions.load_player_transactions
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(DeactivateConfirmation)
