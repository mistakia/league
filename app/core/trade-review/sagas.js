import { call, takeLatest, takeEvery, fork, select } from 'redux-saga/effects'

import { trade_review_actions } from './actions'
import { get_app, get_player_maps } from '@core/selectors'
import {
  api_get_trade_review,
  api_get_trade_review_trade,
  api_get_players
} from '@core/api'

export function* load_trade_review({ payload }) {
  const { leagueId } = payload
  yield call(api_get_trade_review, { leagueId })
}

export function* load_trade_review_trade({ payload }) {
  const { leagueId, trade_uid } = payload
  yield call(api_get_trade_review_trade, { leagueId, trade_uid })
}

const collect_asset_pids = (assets, add_pid) => {
  for (const asset of assets || []) {
    add_pid(asset.player_id)
    for (const resulting_asset of asset.resulting_assets || []) {
      add_pid(resulting_asset.player_id)
    }
    for (const chain_row of asset.chain || []) {
      add_pid(chain_row.player_id)
    }
  }
}

// A trade from 2020 names players who are on no roster in this league today, so
// nothing else on the page puts them in the store and PlayerName renders an
// empty row. Covers the traded asset, everything it became, and every holding
// along a chain on the detail response.
export function* load_missing_trade_review_players({ payload }) {
  const { leagueId } = yield select(get_app)
  const player_maps = yield select(get_player_maps)

  const pids = new Set()
  const add_pid = (pid) => {
    if (pid && !player_maps.getIn([pid, 'first_name'])) pids.add(pid)
  }

  const records = Array.isArray(payload.data) ? payload.data : []
  for (const record of records) {
    collect_asset_pids(record.acquired_assets, add_pid)
    collect_asset_pids(record.sent_assets, add_pid)
  }

  if (pids.size) {
    yield call(api_get_players, { leagueId, pids: Array.from(pids) })
  }
}

export function* watch_load_trade_review() {
  yield takeLatest(trade_review_actions.LOAD_TRADE_REVIEW, load_trade_review)
}

// takeEvery, not takeLatest: expanding a second row must not cancel the first
// row's chain fetch, and the two write to different keys.
export function* watch_load_trade_review_trade() {
  yield takeEvery(
    trade_review_actions.LOAD_TRADE_REVIEW_TRADE,
    load_trade_review_trade
  )
}

export function* watch_get_trade_review_fulfilled() {
  yield takeLatest(
    trade_review_actions.GET_TRADE_REVIEW_FULFILLED,
    load_missing_trade_review_players
  )
}

export function* watch_get_trade_review_trade_fulfilled() {
  yield takeEvery(
    trade_review_actions.GET_TRADE_REVIEW_TRADE_FULFILLED,
    load_missing_trade_review_players
  )
}

export const trade_review_sagas = [
  fork(watch_load_trade_review),
  fork(watch_load_trade_review_trade),
  fork(watch_get_trade_review_fulfilled),
  fork(watch_get_trade_review_trade_fulfilled)
]
