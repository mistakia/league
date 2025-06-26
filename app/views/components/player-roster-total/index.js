import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import {
  getCurrentLeague,
  isBeforeRestrictedFreeAgencyEnd
} from '@core/selectors'
import PlayerRosterTotal from './player-roster-total'

const mapStateToProps = createSelector(
  getCurrentLeague,
  isBeforeRestrictedFreeAgencyEnd,
  (league, isBeforeRestrictedFreeAgencyEnd) => ({
    league,
    isBeforeRestrictedFreeAgencyEnd
  })
)

export default connect(mapStateToProps)(PlayerRosterTotal)
