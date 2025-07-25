import { connect } from 'react-redux'

import { auction_actions } from '@core/auction'

import Filter from '@components/filter'

const map_dispatch_to_props = {
  filter: auction_actions.filter
}

export default connect(null, map_dispatch_to_props)(Filter)
