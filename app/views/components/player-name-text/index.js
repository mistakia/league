import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getPlayerById } from '@core/selectors'

import PlayerNameText from './player-name-text'

const mapStateToProps = createSelector(getPlayerById, (playerMap) => ({
  playerMap
}))

export default connect(mapStateToProps)(PlayerNameText)
