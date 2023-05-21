import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getPlayerById } from '@core/selectors'

import TradeSelectPlayer from './trade-select-player'

const mapStateToProps = createSelector(getPlayerById, (playerMap) => ({
  playerMap
}))

export default connect(mapStateToProps)(TradeSelectPlayer)
