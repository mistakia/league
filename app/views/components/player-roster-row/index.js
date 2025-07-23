import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getPlayerById } from '@core/selectors'

import PlayerRosterRow from './player-roster-row'

const mapStateToProps = createSelector(getPlayerById, (player_map) => ({
  player_map
}))

export default connect(mapStateToProps)(PlayerRosterRow)
