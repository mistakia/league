import { call, takeLatest, fork, select, put } from 'redux-saga/effects'

import { league_actions } from './actions'
import { api_put_league, api_get_league } from '@core/api'
import { app_actions } from '@core/app'
import { get_app, get_league_by_id } from '@core/selectors'
import { notification_actions } from '@core/notifications'
import { team_actions } from '@core/teams'
import { roster_actions } from '@core/rosters'

export function* load_league() {
  const { leagueId } = yield select(get_app)
  if (!leagueId) return

  const league = yield select(get_league_by_id, { lid: leagueId })
  if (league.isLoading || league.isLoaded) {
    return
  }

  yield call(api_get_league, { leagueId })
}

export function* update_league({ payload }) {
  const { token } = yield select(get_app)
  if (token) yield call(api_put_league, payload)
  else yield put(league_actions.set(payload))
}

export function* save_notification() {
  yield put(
    notification_actions.show({
      message: 'League setting saved',
      severity: 'success'
    })
  )
}

//= ====================================
//  WATCHERS
// -------------------------------------

export function* watch_update_league() {
  yield takeLatest(league_actions.UPDATE_LEAGUE, update_league)
}

export function* watch_auth_fulfilled() {
  yield takeLatest(app_actions.AUTH_FULFILLED, load_league)
}

export function* watch_put_league_fulfilled() {
  yield takeLatest(league_actions.PUT_LEAGUE_FULFILLED, save_notification)
}

export function* watch_load_league_team_stats() {
  yield takeLatest(team_actions.LOAD_LEAGUE_TEAM_STATS, load_league)
}

export function* watch_load_rosters() {
  yield takeLatest(roster_actions.LOAD_ROSTERS, load_league)
}

export function* watch_load_teams() {
  yield takeLatest(team_actions.LOAD_TEAMS, load_league)
}

export function* watch_load_league() {
  yield takeLatest(league_actions.LOAD_LEAGUE, load_league)
}

//= ====================================
//  ROOT
// -------------------------------------

export const league_sagas = [
  fork(watch_update_league),
  fork(watch_put_league_fulfilled),
  fork(watch_load_league_team_stats),
  fork(watch_load_rosters),
  fork(watch_load_teams),
  fork(watch_auth_fulfilled),
  fork(watch_load_league)
]
