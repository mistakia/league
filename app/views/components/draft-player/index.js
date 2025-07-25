import { createSelector } from 'reselect'
import { connect } from 'react-redux'

import {
  is_player_drafted,
  get_draft_state,
  get_players_state
} from '@core/selectors'
import { draft_actions } from '@core/draft'

import DraftPlayer from './draft-player'

const map_state_to_props = createSelector(
  get_draft_state,
  is_player_drafted,
  get_players_state,
  (draft, is_player_drafted, players) => ({
    selected: draft.selected,
    is_player_drafted,
    watchlist: players.get('watchlist')
  })
)

const map_dispatch_to_props = {
  select: draft_actions.select_player
}

export default connect(map_state_to_props, map_dispatch_to_props)(DraftPlayer)
