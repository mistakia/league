import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getPlayers } from '@core/players'

import AgeFilter from './age-filter'

const mapStateToProps = createSelector(getPlayers, (players) => ({
  age: players.get('age'),
  allAges: players.get('allAges')
}))

export default connect(mapStateToProps)(AgeFilter)
