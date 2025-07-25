import { connect } from 'react-redux'

import { waiver_actions } from '@core/waivers'

import Filter from '@components/filter'

const map_dispatch_to_props = {
  filter: waiver_actions.filter
}

export default connect(null, map_dispatch_to_props)(Filter)
