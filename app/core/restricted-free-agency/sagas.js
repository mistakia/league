import { call, takeLatest, fork, select } from 'redux-saga/effects'

import { restricted_free_agency_actions } from './actions'
import { get_app, get_player_maps } from '@core/selectors'
import {
  api_get_restricted_free_agency_auctions,
  api_get_players
} from '@core/api'

export function* load_auctions({ payload }) {
  const { leagueId, year } = payload
  yield call(api_get_restricted_free_agency_auctions, { leagueId, year })
}

// A historical auction names players who are no longer on any roster in this
// league, so nothing else on the page puts them in the store and PlayerName
// renders an empty row. Covers the nominated player and every conditional
// release attached to a bid.
export function* load_missing_auction_players({ payload }) {
  const { leagueId } = yield select(get_app)
  const player_maps = yield select(get_player_maps)

  const pids = new Set()
  const add_missing_pid = (pid) => {
    if (pid && !player_maps.getIn([pid, 'first_name'])) pids.add(pid)
  }

  for (const auction of payload.data) {
    add_missing_pid(auction.pid)
    for (const bid of auction.bids) {
      for (const pid of bid.releases) add_missing_pid(pid)
    }
  }

  if (pids.size) {
    yield call(api_get_players, { leagueId, pids: Array.from(pids) })
  }
}

export function* watch_load_restricted_free_agency_auctions() {
  // takeLatest, not takeEvery: switching seasons quickly would otherwise race
  // two responses into the same slot and leave whichever finished last.
  yield takeLatest(
    restricted_free_agency_actions.LOAD_RESTRICTED_FREE_AGENCY_AUCTIONS,
    load_auctions
  )
}

export function* watch_get_restricted_free_agency_auctions_fulfilled() {
  yield takeLatest(
    restricted_free_agency_actions.GET_RESTRICTED_FREE_AGENCY_AUCTIONS_FULFILLED,
    load_missing_auction_players
  )
}

export const restricted_free_agency_sagas = [
  fork(watch_load_restricted_free_agency_auctions),
  fork(watch_get_restricted_free_agency_auctions_fulfilled)
]
