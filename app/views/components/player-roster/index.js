import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { isBeforeExtensionDeadline } from '@core/leagues'

import PlayerRoster from './player-roster'

const mapStateToProps = createSelector(
  isBeforeExtensionDeadline,
  (isBeforeExtensionDeadline) => ({ isBeforeExtensionDeadline })
)

export default connect(mapStateToProps)(PlayerRoster)
