import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { confirmation_actions } from '@core/confirmations'
import { get_confirmation_info } from '@core/selectors'

import Confirmation from './confirmation'

const map_state_to_props = createSelector(get_confirmation_info, (info) => ({
  info
}))

const map_dispatch_to_props = {
  cancel: confirmation_actions.cancel
}

export default connect(map_state_to_props, map_dispatch_to_props)(Confirmation)
