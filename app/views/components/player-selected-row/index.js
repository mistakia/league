import { connect } from 'react-redux'

import { percentileActions } from '@core/percentiles'

import PlayerSelectedRow from './player-selected-row'

const mapDispatchToProps = {
  load_percentiles: percentileActions.load_percentiles
}

export default connect(null, mapDispatchToProps)(PlayerSelectedRow)
