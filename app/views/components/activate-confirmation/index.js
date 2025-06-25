import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { roster_actions } from '@core/rosters'
import { getCurrentPlayers } from '@core/selectors'

import ActivateConfirmation from './activate-confirmation'

const mapStateToProps = createSelector(getCurrentPlayers, (team) => ({
  team
}))

const mapDispatchToProps = {
  activate: roster_actions.activate
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(ActivateConfirmation)
