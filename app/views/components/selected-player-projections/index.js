import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getSelectedPlayer } from '@core/players'

import SelectedPlayerSeasonProjections from './selected-player-projections'

const mapStateToProps = createSelector(
  getSelectedPlayer,
  (player) => ({ player })
)

export default connect(
  mapStateToProps
)(SelectedPlayerSeasonProjections)
