import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getPlayerById, playerActions } from '@core/players'

import PlayerNameExpanded from './player-name-expanded'

const mapStateToProps = createSelector(
  getPlayerById,
  (player) => ({ player })
)

const mapDispatchToProps = {
  select: playerActions.selectPlayer
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(PlayerNameExpanded)
