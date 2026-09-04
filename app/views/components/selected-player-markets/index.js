import { Map, List } from 'immutable'
import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { get_player_maps } from '@core/selectors'
import { player_actions } from '@core/players/actions'

import SelectedPlayerMarkets from './selected-player-markets'
import { build_untyped_market_key } from './market-navigation'

const map_state_to_props = createSelector(
  get_player_maps,
  (state) => state.getIn(['players', 'selected']),
  (player_maps, selected_player_id) => {
    const player_map = player_maps.get(selected_player_id, new Map())
    const player_betting_markets = player_map.get('betting_markets', new List())

    // A market carrying no market_type used to key on its source_market_name,
    // which is one navigation entry per distinct market name per book -- 523 of
    // one player's 570 entries. Collapsing the tail to one entry per book takes
    // that player to 73 and the average player from 52.7 to 10.3. No market
    // becomes unreachable: an untyped market still appears, under its book.
    const grouped_markets = player_betting_markets.groupBy((market) => {
      if (market.market_type) {
        return market.market_type
      }
      return build_untyped_market_key(market.source_id)
    })

    return {
      player_map,
      grouped_markets: grouped_markets.toJS()
    }
  }
)

const map_dispatch_to_props = {
  load_player_betting_markets: player_actions.load_player_betting_markets
}

export default connect(
  map_state_to_props,
  map_dispatch_to_props
)(SelectedPlayerMarkets)
