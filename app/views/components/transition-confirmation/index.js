import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getCurrentLeague } from '@core/leagues'
import { getCurrentPlayers } from '@core/rosters'

import TransitionConfirmation from './transition-confirmation'

const mapStateToProps = createSelector(
  getCurrentLeague,
  getCurrentPlayers,
  (league, team) => ({ league, team })
)

export default connect(mapStateToProps)(TransitionConfirmation)
