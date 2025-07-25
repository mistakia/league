import { connect } from 'react-redux'
import { player_actions } from '@core/players'

import Filter from '@components/filter'

const map_dispatch_to_props = {
  filter: player_actions.filter
}

export default connect(null, map_dispatch_to_props)(Filter)
