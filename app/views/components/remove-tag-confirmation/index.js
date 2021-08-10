import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getCurrentLeague } from '@core/leagues'
import { getCurrentPlayers, rosterActions } from '@core/rosters'

import RemoveTagConfirmation from './remove-tag-confirmation'

const mapStateToProps = createSelector(
  getCurrentLeague,
  getCurrentPlayers,
  (league, team) => ({
    league,
    team
  })
)

const mapDispatchToProps = {
  remove: rosterActions.removeTag
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(RemoveTagConfirmation)
