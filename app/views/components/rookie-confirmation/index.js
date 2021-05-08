import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getCurrentLeague } from '@core/leagues'
import { getCurrentPlayers, rosterActions } from '@core/rosters'

import RookieConfirmation from './rookie-confirmation'

const mapStateToProps = createSelector(
  getCurrentLeague,
  getCurrentPlayers,
  (league, team) => ({ league, team })
)

const mapDispatchToProps = {
  tag: rosterActions.tag
}

export default connect(mapStateToProps, mapDispatchToProps)(RookieConfirmation)
