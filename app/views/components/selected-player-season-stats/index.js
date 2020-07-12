import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getGamesByYearForSelectedPlayer } from '@core/players'

import SelectedPlayerSeasonStats from './selected-player-season-stats'

const mapStateToProps = createSelector(
  getGamesByYearForSelectedPlayer,
  (stats) => ({ stats })
)

export default connect(
  mapStateToProps
)(SelectedPlayerSeasonStats)
