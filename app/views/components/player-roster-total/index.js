import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getCurrentLeague, isBeforeExtensionDeadline } from '@core/leagues'
import PlayerRosterTotal from './player-roster-total'

const mapStateToProps = createSelector(
  getCurrentLeague,
  isBeforeExtensionDeadline,
  (league, isBeforeExtensionDeadline) => ({
    league,
    isBeforeExtensionDeadline
  })
)

export default connect(mapStateToProps)(PlayerRosterTotal)
