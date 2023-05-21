import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getPlayers } from '@core/selectors'

import WeekFilter from './week-filter'

const mapStateToProps = createSelector(getPlayers, (players) => ({
  week: players.get('week')
}))

export default connect(mapStateToProps)(WeekFilter)
