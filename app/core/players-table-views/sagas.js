import { takeLatest, fork, call, select } from 'redux-saga/effects'

import { players_table_views_actions } from './actions'
// import { get_app } from '@core/selectors'
import {
  post_players_table_view_search,
  post_players_table_view
} from '@core/api'
import { get_selected_players_table_view } from '@core/selectors'

export function* players_table_view_changed({ payload }) {
  const { view_change_params = {} } = payload
  const { view_state_changed } = view_change_params

  if (!view_state_changed) {
    return
  }

  const players_table_view = yield select(get_selected_players_table_view)
  const { columns } = players_table_view.table_state

  if (!columns.length) {
    return
  }

  // const { userId } = yield select(get_app)
  // if (!userId || userId !== players_table_view.creator_user_id) {
  //   return
  // }

  const opts = {
    view_id: players_table_view.view_id,
    ...players_table_view.table_state
  }

  yield call(post_players_table_view_search, opts)
}

export function* save_players_table_view({ payload }) {
  const { players_table_view } = payload
  const { view_id, view_name, view_description, table_state } =
    players_table_view

  const params = {
    view_id,
    view_name,
    view_description,
    table_state
  }

  yield call(post_players_table_view, params)
}

//= ====================================
//  WATCHERS
// -------------------------------------

export function* watchPlayersTableViewChanged() {
  yield takeLatest(
    players_table_views_actions.PLAYERS_TABLE_VIEW_CHANGED,
    players_table_view_changed
  )
}

export function* watchSetSelectedPlayersTableView() {
  yield takeLatest(
    players_table_views_actions.SET_SELECTED_PLAYERS_TABLE_VIEW,
    players_table_view_changed
  )
}

export function* watchSavePlayersTableView() {
  yield takeLatest(
    players_table_views_actions.SAVE_PLAYERS_TABLE_VIEW,
    save_players_table_view
  )
}

//= ====================================
//  ROOT
// -------------------------------------

export const players_table_views_sagas = [
  fork(watchPlayersTableViewChanged),
  fork(watchSetSelectedPlayersTableView),
  fork(watchSavePlayersTableView)
]
