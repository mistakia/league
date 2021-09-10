import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getSelectedPlayer, playerActions } from '@core/players'

import SelectedPlayerSeasonProjections from './selected-player-projections'

const mapStateToProps = createSelector(getSelectedPlayer, (player) => ({
  player
}))

const mapDispatchToProps = {
  load: playerActions.getPlayerProjections
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(SelectedPlayerSeasonProjections)
