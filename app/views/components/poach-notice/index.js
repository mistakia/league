import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { poach_actions } from '@core/poaches/actions'
import { confirmation_actions } from '@core/confirmations'
import { get_app } from '@core/selectors'

import PoachNotice from './poach-notice'

const map_state_to_props = createSelector(get_app, (app) => ({
  teamId: app.teamId
}))

const map_dispatch_to_props = {
  process_poach: poach_actions.process_poach,
  showConfirmation: confirmation_actions.show
}

export default connect(map_state_to_props, map_dispatch_to_props)(PoachNotice)
