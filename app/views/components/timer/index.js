import { connect } from 'react-redux'

import { auction_actions } from '@core/auction'

import Timer from './timer'

const map_dispatch_to_props = {
  soundNotification: auction_actions.soundNotification
}

export default connect(null, map_dispatch_to_props)(Timer)
