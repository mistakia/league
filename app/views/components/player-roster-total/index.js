import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getCurrentLeague, isBeforeTransitionEnd } from '@core/selectors'
import PlayerRosterTotal from './player-roster-total'

const mapStateToProps = createSelector(
  getCurrentLeague,
  isBeforeTransitionEnd,
  (league, isBeforeTransitionEnd) => ({
    league,
    isBeforeTransitionEnd
  })
)

export default connect(mapStateToProps)(PlayerRosterTotal)
