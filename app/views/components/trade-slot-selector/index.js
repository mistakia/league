import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { trade_actions } from '@core/trade'
import { getPlayerById, get_trade } from '@core/selectors'

import TradeSlotSelector from './trade-slot-selector'

const map_state_to_props = createSelector(
  (state, props) => getPlayerById(state, { pid: props.pid }),
  get_trade,
  (_, props) => props.pid,
  (_, props) => props.team_type,
  (player_map, trade, pid, team_type) => {
    const slot_map =
      team_type === 'proposing'
        ? trade.proposingTeamSlots
        : trade.acceptingTeamSlots

    const selected_slot = slot_map.get(pid)

    return {
      player_map,
      selected_slot
    }
  }
)

const map_dispatch_to_props = {
  set_proposing_team_slot: trade_actions.set_proposing_team_slot,
  set_accepting_team_slot: trade_actions.set_accepting_team_slot
}

export default connect(
  map_state_to_props,
  map_dispatch_to_props
)(TradeSlotSelector)
