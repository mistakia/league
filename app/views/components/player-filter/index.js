import { connect } from 'react-redux'
import { player_actions } from '@core/players'

import Filter from '@components/filter'

const mapDispatchToProps = {
  filter: player_actions.filter
}

export default connect(null, mapDispatchToProps)(Filter)
