import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getPlayerById, playerActions } from '@core/players'
import { getGameByPlayerId } from '@core/schedule'

import PlayerNameExpanded from './player-name-expanded'

const mapStateToProps = createSelector(
  getPlayerById,
  getGameByPlayerId,
  (player, game) => ({ player, game })
)

const mapDispatchToProps = {
  select: playerActions.selectPlayer
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(PlayerNameExpanded)
