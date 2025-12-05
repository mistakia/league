import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { get_players_state } from '@core/selectors'
import { player_actions } from '@core/players'

import PlayersTimePeriodFilter from './players-time-period-filter'

const map_state_to_props = createSelector(get_players_state, (players) => ({
  opponent_time_period: players.get('opponent_time_period')
}))

const map_dispatch_to_props = {
  set_opponent_time_period: player_actions.set_opponent_time_period
}

export default connect(
  map_state_to_props,
  map_dispatch_to_props
)(PlayersTimePeriodFilter)
