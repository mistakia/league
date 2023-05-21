import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getPlayers } from '@core/selectors'

import PositionFilter from './position-filter'

const mapStateToProps = createSelector(getPlayers, (players) => ({
  positions: players.get('positions')
}))

export default connect(mapStateToProps)(PositionFilter)
