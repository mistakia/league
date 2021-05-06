import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getSelectedPlayer, playerActions } from '@core/players'

import SelectedPlayer from './selected-player'

const mapStateToProps = createSelector(getSelectedPlayer, (player) => ({
  player
}))

const mapDispatchToProps = {
  deselect: playerActions.deselectPlayer
}

export default connect(mapStateToProps, mapDispatchToProps)(SelectedPlayer)
