import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import {
  isBeforeExtensionDeadline,
  isBeforeTransitionDeadline
} from '@core/leagues'

import PlayerRoster from './player-roster'

const mapStateToProps = createSelector(
  isBeforeExtensionDeadline,
  isBeforeTransitionDeadline,
  (isBeforeExtensionDeadline, isBeforeTransitionDeadline) => ({
    isBeforeExtensionDeadline,
    isBeforeTransitionDeadline
  })
)

export default connect(mapStateToProps)(PlayerRoster)
