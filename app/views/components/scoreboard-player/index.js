import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getPlayerById } from '@core/players'

import ScoreboardPlayer from './scoreboard-player'

const mapStateToProps = createSelector(
  getPlayerById,
  (player) => ({ player })
)

export default connect(
  mapStateToProps
)(ScoreboardPlayer)
