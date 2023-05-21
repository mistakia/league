import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getPlayers } from '@core/selectors'

import CollegeFilter from './college-filter'

const mapStateToProps = createSelector(getPlayers, (players) => ({
  colleges: players.get('colleges')
}))

export default connect(mapStateToProps)(CollegeFilter)
