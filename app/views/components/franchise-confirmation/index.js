import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getCurrentPlayers } from '@core/selectors'
import { roster_actions } from '@core/rosters'

import FranchiseConfirmation from './franchise-confirmation'

const mapStateToProps = createSelector(getCurrentPlayers, (team) => ({
  team
}))

const mapDispatchToProps = {
  add: roster_actions.add_tag
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(FranchiseConfirmation)
