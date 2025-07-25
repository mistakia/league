import { fork, takeLatest, call, select } from 'redux-saga/effects'

import { player_actions } from '@core/players'
import { get_app } from '@core/selectors'
import { api_get_draft_pick_value } from '@core/api'
import { trade_actions } from '@core/trade'
import { draft_pick_value_actions } from './actions'

export function* load_draft_pick_value() {
  const { leagueId } = yield select(get_app)
  yield call(api_get_draft_pick_value, { leagueId })
}

//= ====================================
//  WATCHERS
// -------------------------------------

export function* watch_players_select_player() {
  yield takeLatest(player_actions.PLAYERS_SELECT_PLAYER, load_draft_pick_value)
}

export function* watch_load_trades() {
  yield takeLatest(trade_actions.LOAD_TRADES, load_draft_pick_value)
}

export function* watch_load_draft_pick_value() {
  yield takeLatest(
    draft_pick_value_actions.LOAD_DRAFT_PICK_VALUE,
    load_draft_pick_value
  )
}

//= ====================================
//  ROOT
// -------------------------------------

export const draft_pick_value_sagas = [
  fork(watch_players_select_player),
  fork(watch_load_trades),
  fork(watch_load_draft_pick_value)
]
