import { connect } from 'react-redux'
import { playerActions } from '@core/players'

import Filter from '@components/filter'

const mapDispatchToProps = {
  filter: playerActions.filter
}

export default connect(null, mapDispatchToProps)(Filter)
