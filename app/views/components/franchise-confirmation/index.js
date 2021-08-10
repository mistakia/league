import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getCurrentLeague } from '@core/leagues'
import { getCurrentPlayers, rosterActions } from '@core/rosters'

import FranchiseConfirmation from './franchise-confirmation'

const mapStateToProps = createSelector(
  getCurrentLeague,
  getCurrentPlayers,
  (league, team) => ({
    league,
    team
  })
)

const mapDispatchToProps = {
  add: rosterActions.addTag
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(FranchiseConfirmation)
