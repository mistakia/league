import { connect } from 'react-redux'

import { matchupsActions } from '@core/matchups'

import Filter from '@components/filter'

const mapDispatchToProps = {
  filter: matchupsActions.filter
}

export default connect(null, mapDispatchToProps)(Filter)
