import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { playerActions, getSelectedPlayer } from '@core/players'

import SelectedPlayerSeasonProjections from './selected-player-season-projections'

const mapStateToProps = createSelector(
  getSelectedPlayer,
  (player) => ({ player })
)

const mapDispatchToProps = {
  delete: playerActions.deleteProjection
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(SelectedPlayerSeasonProjections)
