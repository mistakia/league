import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getSelectedPlayer } from '@core/selectors'
import { player_actions } from '@core/players'

import SelectedPlayerSeasonProjections from './selected-player-projections'

const mapStateToProps = createSelector(getSelectedPlayer, (playerMap) => ({
  playerMap
}))

const mapDispatchToProps = {
  load: player_actions.load_player_projections
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(SelectedPlayerSeasonProjections)
