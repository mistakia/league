import { connect } from 'react-redux'

import { matchups_actions } from '@core/matchups'

import Filter from '@components/filter'

const map_dispatch_to_props = {
  filter: matchups_actions.filter
}

export default connect(null, map_dispatch_to_props)(Filter)
