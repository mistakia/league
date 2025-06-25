import { connect } from 'react-redux'

import { roster_actions } from '@core/rosters'

import ReserveLongTermConfirmation from './reserve-long-term-confirmation'

const mapDispatchToProps = {
  reserve: roster_actions.reserve
}

export default connect(null, mapDispatchToProps)(ReserveLongTermConfirmation)
