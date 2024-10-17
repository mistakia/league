import { connect } from 'react-redux'

import { playerActions } from '@core/players'

import SelectedPlayerProjection from './selected-player-projection'

const mapDispatchToProps = {
  delete_projection: playerActions.deleteProjection
}

export default connect(null, mapDispatchToProps)(SelectedPlayerProjection)
