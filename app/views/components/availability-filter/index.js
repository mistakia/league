import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getPlayers } from '@core/selectors'

import AvailabilityFilter from './availability-filter'

const mapStateToProps = createSelector(getPlayers, (players) => ({
  availability: players.get('availability')
}))

export default connect(mapStateToProps)(AvailabilityFilter)
