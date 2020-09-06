import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getPlayerById } from '@core/players'

import TradeSelectPlayer from './trade-select-player'

const mapStateToProps = createSelector(
  getPlayerById,
  (player) => ({ player })
)

export default connect(
  mapStateToProps
)(TradeSelectPlayer)
