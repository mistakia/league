import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { get_notification_info } from '@core/selectors'

import Notification from './notification'

const mapStateToProps = createSelector(get_notification_info, (info) => ({
  info
}))

export default connect(mapStateToProps)(Notification)
