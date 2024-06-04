import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getPlayers } from '@core/selectors'

import StatusFilter from './status-filter'

const mapStateToProps = createSelector(getPlayers, (players) => ({
  selected_nfl_statuses: players.get('selected_nfl_statuses')
}))

export default connect(mapStateToProps)(StatusFilter)
