import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getNotificationInfo } from '@core/notifications'

import Notification from './notification'

const mapStateToProps = createSelector(getNotificationInfo, (info) => ({
  info
}))

export default connect(mapStateToProps)(Notification)
