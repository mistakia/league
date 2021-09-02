import { connect } from 'react-redux'

import { auctionActions } from '@core/auction'

import Timer from './timer'

const mapDispatchToProps = {
  soundNotification: auctionActions.soundNotification
}

export default connect(null, mapDispatchToProps)(Timer)
