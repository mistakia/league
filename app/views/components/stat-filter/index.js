import { connect } from 'react-redux'
import { stat_actions } from '@core/stats'

import Filter from '@components/filter'

const map_dispatch_to_props = {
  filter: stat_actions.filter
}

export default connect(null, map_dispatch_to_props)(Filter)
