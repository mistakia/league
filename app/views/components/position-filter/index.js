import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getPlayers, get_positions_for_current_league } from '@core/selectors'

import PositionFilter from './position-filter'

const mapStateToProps = createSelector(
  getPlayers,
  get_positions_for_current_league,
  (players, league_positions) => ({
    positions: players.get('positions'),
    league_positions
  })
)

export default connect(mapStateToProps)(PositionFilter)
