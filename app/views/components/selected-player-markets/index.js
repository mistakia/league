import { Map, List } from 'immutable'
import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { get_player_maps } from '@core/selectors'
import { player_actions } from '@core/players/actions'

import SelectedPlayerMarkets from './selected-player-markets'

const mapStateToProps = createSelector(
  get_player_maps,
  (state) => state.getIn(['players', 'selected']),
  (player_maps, selected_player_id) => {
    const player_map = player_maps.get(selected_player_id, new Map())
    const player_betting_markets = player_map.get('betting_markets', new List())

    const grouped_markets = player_betting_markets.groupBy((market) => {
      if (market.market_type) {
        return market.market_type
      }
      return `${market.source_id}_${market.source_market_name}`
    })

    return {
      player_map,
      grouped_markets: grouped_markets.toJS()
    }
  }
)

const mapDispatchToProps = {
  load_player_betting_markets: player_actions.load_player_betting_markets
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(SelectedPlayerMarkets)
