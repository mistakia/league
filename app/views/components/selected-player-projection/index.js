import { connect } from 'react-redux'

import { player_actions } from '@core/players'

import SelectedPlayerProjection from './selected-player-projection'

const map_dispatch_to_props = {
  delete_projection: player_actions.delete_projection
}

export default connect(null, map_dispatch_to_props)(SelectedPlayerProjection)
