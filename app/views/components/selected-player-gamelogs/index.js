import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getGamesForSelectedPlayer, getSelectedPlayer } from '@core/players'

import SelectedPlayerGamelogs from './selected-player-gamelogs'

const mapStateToProps = createSelector(
  getGamesForSelectedPlayer,
  getSelectedPlayer,
  (gamelogs, player) => ({ gamelogs, player })
)

export default connect(
  mapStateToProps
)(SelectedPlayerGamelogs)
