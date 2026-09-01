import { call, takeEvery, takeLatest, fork } from 'redux-saga/effects'

import { api_key_actions } from './actions'
import {
  api_get_api_keys,
  api_post_api_key,
  api_put_api_key,
  api_delete_api_key
} from '@core/api'

export function* load_api_keys() {
  yield call(api_get_api_keys)
}

export function* create_api_key({ payload }) {
  yield call(api_post_api_key, payload)
}

export function* rename_api_key({ payload }) {
  yield call(api_put_api_key, payload)
}

export function* revoke_api_key({ payload }) {
  yield call(api_delete_api_key, payload)
}

//= ====================================
//  WATCHERS
// -------------------------------------

export function* watch_load_api_keys() {
  yield takeLatest(api_key_actions.LOAD_API_KEYS, load_api_keys)
}

export function* watch_create_api_key() {
  yield takeLatest(api_key_actions.CREATE_API_KEY, create_api_key)
}

// takeEvery rather than takeLatest: two keys renamed in quick succession are
// independent edits, and takeLatest would cancel the first request.
export function* watch_rename_api_key() {
  yield takeEvery(api_key_actions.RENAME_API_KEY, rename_api_key)
}

export function* watch_revoke_api_key() {
  yield takeLatest(api_key_actions.REVOKE_API_KEY, revoke_api_key)
}

//= ====================================
//  ROOT
// -------------------------------------

export const api_key_sagas = [
  fork(watch_load_api_keys),
  fork(watch_create_api_key),
  fork(watch_rename_api_key),
  fork(watch_revoke_api_key)
]
