import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getPlayers } from '@core/players'

import StatusFilter from './status-filter'

const mapStateToProps = createSelector(getPlayers, (players) => ({
  status: players.get('status')
}))

export default connect(mapStateToProps)(StatusFilter)
