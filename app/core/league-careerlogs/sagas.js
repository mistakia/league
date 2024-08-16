import { fork, call, select, takeLatest } from 'redux-saga/effects'

import { league_careerlogs_actions } from './actions'
import { get_request_history } from '@core/selectors'
import { get_league_careerlogs } from '@core/api'

export function* load_league_careerlogs({ payload }) {
  const { leagueId } = payload
  const request_history = yield select(get_request_history)
  const key = `GET_LEAGUE_CAREERLOGS_${leagueId}`
  if (request_history.has(key)) {
    return
  }

  yield call(get_league_careerlogs, { leagueId })
}

//= ====================================
//  WATCHERS
// -------------------------------------

export function* watch_load_league_careerlogs() {
  yield takeLatest(
    league_careerlogs_actions.LOAD_LEAGUE_CAREERLOGS,
    load_league_careerlogs
  )
}

//= ====================================
//  ROOT
// -------------------------------------

export const league_careerlogs_sagas = [fork(watch_load_league_careerlogs)]
