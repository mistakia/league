import { connect } from 'react-redux'
import { playerActions } from '@core/players'

import PlayerFilter from './player-filter'

const mapDispatchToProps = {
  filter: playerActions.filter
}

export default connect(
  null,
  mapDispatchToProps
)(PlayerFilter)
