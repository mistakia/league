import { connect } from 'react-redux'
import { statActions } from '@core/stats'

import Filter from '@components/filter'

const mapDispatchToProps = {
  filter: statActions.filter
}

export default connect(null, mapDispatchToProps)(Filter)
