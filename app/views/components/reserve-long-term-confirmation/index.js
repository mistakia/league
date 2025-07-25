import { connect } from 'react-redux'

import { roster_actions } from '@core/rosters'

import ReserveLongTermConfirmation from './reserve-long-term-confirmation'

const map_dispatch_to_props = {
  reserve: roster_actions.reserve
}

export default connect(null, map_dispatch_to_props)(ReserveLongTermConfirmation)
