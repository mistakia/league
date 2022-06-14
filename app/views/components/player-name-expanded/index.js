import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getPlayerById, playerActions } from '@core/players'
import { getGameStatusByPlayerId } from '@core/scoreboard'

import PlayerNameExpanded from './player-name-expanded'

const mapStateToProps = createSelector(
  getPlayerById,
  getGameStatusByPlayerId,
  (playerMap, status) => ({ playerMap, status })
)

const mapDispatchToProps = {
  select: playerActions.selectPlayer
}

export default connect(mapStateToProps, mapDispatchToProps)(PlayerNameExpanded)
