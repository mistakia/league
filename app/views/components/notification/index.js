import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { get_notification_info } from '@core/selectors'

import Notification from './notification'

const map_state_to_props = createSelector(get_notification_info, (info) => ({
  info
}))

export default connect(map_state_to_props)(Notification)
