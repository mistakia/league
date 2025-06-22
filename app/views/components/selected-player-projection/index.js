import { connect } from 'react-redux'

import { player_actions } from '@core/players'

import SelectedPlayerProjection from './selected-player-projection'

const mapDispatchToProps = {
  delete_projection: player_actions.delete_projection
}

export default connect(null, mapDispatchToProps)(SelectedPlayerProjection)
