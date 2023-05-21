import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { playerActions } from '@core/players'
import { getSelectedPlayer, get_app } from '@core/selectors'

import SelectedPlayer from './selected-player'

const mapStateToProps = createSelector(
  getSelectedPlayer,
  get_app,
  (playerMap, app) => ({
    playerMap,
    isLoggedIn: Boolean(app.userId)
  })
)

const mapDispatchToProps = {
  deselect: playerActions.deselectPlayer
}

export default connect(mapStateToProps, mapDispatchToProps)(SelectedPlayer)
