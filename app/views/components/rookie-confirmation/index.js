import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getCurrentLeague, getCurrentPlayers } from '@core/selectors'
import { rosterActions } from '@core/rosters'

import RookieConfirmation from './rookie-confirmation'

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

export default connect(mapStateToProps, mapDispatchToProps)(RookieConfirmation)
