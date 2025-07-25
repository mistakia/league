import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { get_status } from '@core/selectors'
import { status_actions } from '@core/status'

import StatusPage from './status'

const map_state_to_props = createSelector(get_status, (status) => ({ status }))

const map_dispatch_to_props = {
  load: status_actions.load
}

export default connect(map_state_to_props, map_dispatch_to_props)(StatusPage)
