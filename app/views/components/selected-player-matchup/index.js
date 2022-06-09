import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getSelectedPlayer, getSelectedPlayerGames } from '@core/players'

import SelectedPlayerMatchup from './selected-player-matchup'

const mapStateToProps = createSelector(
  getSelectedPlayer,
  getSelectedPlayerGames,
  (playerMap, games) => ({ team: playerMap.get('team'), games })
)

export default connect(mapStateToProps)(SelectedPlayerMatchup)
