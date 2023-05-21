import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getPlayers } from '@core/selectors'

import StatusFilter from './status-filter'

const mapStateToProps = createSelector(getPlayers, (players) => ({
  status: players.get('status')
}))

export default connect(mapStateToProps)(StatusFilter)
