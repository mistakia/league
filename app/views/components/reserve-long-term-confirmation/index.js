import { connect } from 'react-redux'

import { rosterActions } from '@core/rosters'

import ReserveLongTermConfirmation from './reserve-long-term-confirmation'

const mapDispatchToProps = {
  reserve: rosterActions.reserve
}

export default connect(null, mapDispatchToProps)(ReserveLongTermConfirmation)
