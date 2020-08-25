import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getPlayerById } from '@core/players'

import PlayerNameExpanded from './player-name-expanded'

const mapStateToProps = createSelector(
  getPlayerById,
  (player) => ({ player })
)

export default connect(
  mapStateToProps
)(PlayerNameExpanded)
