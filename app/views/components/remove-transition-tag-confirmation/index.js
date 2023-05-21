import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getCurrentLeague, getCurrentPlayers } from '@core/selectors'
import { rosterActions } from '@core/rosters'

import RemoveTransitionTagConfirmation from './remove-transition-tag-confirmation'

const mapStateToProps = createSelector(
  getCurrentLeague,
  getCurrentPlayers,
  (league, team) => ({
    league,
    team
  })
)

const mapDispatchToProps = {
  remove: rosterActions.removeTransitionTag
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(RemoveTransitionTagConfirmation)
