import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getSelectedPlayer } from '@core/players'

import SelectedPlayerValue from './selected-player-value'

const mapStateToProps = createSelector(getSelectedPlayer, (player) => ({
  player
}))

export default connect(mapStateToProps)(SelectedPlayerValue)
