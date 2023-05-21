import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getPlayerById } from '@core/selectors'

import TradePlayer from './trade-player'

const mapStateToProps = createSelector(getPlayerById, (playerMap) => ({
  playerMap
}))

export default connect(mapStateToProps)(TradePlayer)
