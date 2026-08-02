import { call, takeLatest, fork } from 'redux-saga/effects'

import { restricted_free_agency_actions } from './actions'
import { api_get_restricted_free_agency_auctions } from '@core/api'

export function* load_auctions({ payload }) {
  const { leagueId, year } = payload
  yield call(api_get_restricted_free_agency_auctions, { leagueId, year })
}

export function* watch_load_restricted_free_agency_auctions() {
  // takeLatest, not takeEvery: switching seasons quickly would otherwise race
  // two responses into the same slot and leave whichever finished last.
  yield takeLatest(
    restricted_free_agency_actions.LOAD_RESTRICTED_FREE_AGENCY_AUCTIONS,
    load_auctions
  )
}

export const restricted_free_agency_sagas = [
  fork(watch_load_restricted_free_agency_auctions)
]
