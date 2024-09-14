import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { playerActions } from '@core/players'
import { getPlayerById, getGameStatusByPlayerId } from '@core/selectors'
import { constants } from '#libs-shared'

import PlayerNameExpanded from './player-name-expanded'

const mapStateToProps = createSelector(
  getPlayerById,
  getGameStatusByPlayerId,
  (state) => state.getIn(['app', 'year'], constants.year),
  (playerMap, status, selected_year) => ({ playerMap, status, selected_year })
)

const mapDispatchToProps = {
  select: playerActions.selectPlayer
}

export default connect(mapStateToProps, mapDispatchToProps)(PlayerNameExpanded)
