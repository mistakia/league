import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getSelectedPlayer } from '@core/players'

import SelectedPlayerPractice from './selected-player-practice'

const mapStateToProps = createSelector(getSelectedPlayer, (player) => ({
  player
}))

export default connect(mapStateToProps)(SelectedPlayerPractice)
