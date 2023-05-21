import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import {
  isBeforeExtensionDeadline,
  isRestrictedFreeAgencyPeriod
} from '@core/selectors'

import PlayerRoster from './player-roster'

const mapStateToProps = createSelector(
  isRestrictedFreeAgencyPeriod,
  isBeforeExtensionDeadline,
  (isRestrictedFreeAgencyPeriod, isBeforeExtensionDeadline) => ({
    isRestrictedFreeAgencyPeriod,
    isBeforeExtensionDeadline
  })
)

export default connect(mapStateToProps)(PlayerRoster)
