import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { all } from 'redux-saga/effects'

import { inject_reducer, inject_saga } from '@core/store'
import {
  getSelectedPlayer,
  get_player_seasonlogs_for_selected_player
} from '@core/selectors'
import {
  plays_views_actions,
  plays_views_reducer,
  plays_views_sagas
} from '@core/plays-view'
import { selected_player_plays_request_reducer } from '@core/selected-player-plays-request/reducer'

import SelectedPlayerPlays from './selected-player-plays'

inject_reducer(
  'selected_player_plays_request',
  selected_player_plays_request_reducer
)

// The player drawer is mounted app-wide, but the saga that services
// SELECTED_PLAYER_PLAYS_REQUEST was injected only by the /plays page. Anywhere
// else -- which is everywhere the drawer is actually opened from -- the action
// had no watcher, so the request was never sent and the tab sat on an empty
// table with no error and no pending state. Both keys match the page's, and
// inject_* is idempotent by key, so whichever mounts first wins.
inject_reducer('plays_views', plays_views_reducer)
inject_saga('plays_views', function* root_plays_views_saga() {
  yield all(plays_views_sagas)
})

const map_state_to_props = createSelector(
  getSelectedPlayer,
  get_player_seasonlogs_for_selected_player,
  (state) => state.get('selected_player_plays_request'),
  (player_map, player_seasonlogs, selected_player_plays_request) => ({
    player_map,
    player_seasonlogs,
    selected_player_plays_request
  })
)

const map_dispatch_to_props = {
  send_plays_request: plays_views_actions.selected_player_plays_request
}

export default connect(
  map_state_to_props,
  map_dispatch_to_props
)(SelectedPlayerPlays)
