import { connect } from 'react-redux'

import { percentile_actions } from '@core/percentiles'

import PlayerSelectedRow from './player-selected-row'

const map_dispatch_to_props = {
  load_percentiles: percentile_actions.load_percentiles
}

export default connect(null, map_dispatch_to_props)(PlayerSelectedRow)
