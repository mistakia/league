import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { isRestrictedFreeAgencyPeriod } from '@core/leagues'

import PlayerRoster from './player-roster'

const mapStateToProps = createSelector(
  isRestrictedFreeAgencyPeriod,
  (isRestrictedFreeAgencyPeriod) => ({
    isRestrictedFreeAgencyPeriod
  })
)

export default connect(mapStateToProps)(PlayerRoster)
