import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { playerActions } from '@core/players'
import { getPlayerById, getGameStatusByPlayerId } from '@core/selectors'

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
