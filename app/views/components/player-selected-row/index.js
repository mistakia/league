import { connect } from 'react-redux'

import { percentileActions } from '@core/percentiles'

import PlayerSelectedRow from './player-selected-row'

const mapDispatchToProps = {
  loadPercentiles: percentileActions.loadPercentiles
}

export default connect(null, mapDispatchToProps)(PlayerSelectedRow)
