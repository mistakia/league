import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getSelectedPlayer } from '@core/selectors'
import { playerActions } from '@core/players'

import SelectedPlayerSeasonProjections from './selected-player-projections'

const mapStateToProps = createSelector(getSelectedPlayer, (playerMap) => ({
  playerMap
}))

const mapDispatchToProps = {
  load: playerActions.getPlayerProjections
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(SelectedPlayerSeasonProjections)
