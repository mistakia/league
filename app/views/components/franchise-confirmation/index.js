import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getCurrentPlayers } from '@core/selectors'
import { rosterActions } from '@core/rosters'

import FranchiseConfirmation from './franchise-confirmation'

const mapStateToProps = createSelector(getCurrentPlayers, (team) => ({
  team
}))

const mapDispatchToProps = {
  add: rosterActions.addTag
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(FranchiseConfirmation)
