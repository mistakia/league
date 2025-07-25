import dayjs from 'dayjs'
import isBetween from 'dayjs/plugin/isBetween'
import { call, takeLatest, fork, select } from 'redux-saga/effects'

import { app_actions } from '@core/app'
import {
  get_app,
  get_draft_state,
  get_rookie_draft_next_pick,
  get_current_league
} from '@core/selectors'
import { draft_actions } from './actions'
import { api_get_draft, api_post_draft } from '@core/api'
import { constants } from '@libs-shared'

dayjs.extend(isBetween)

export function* load_draft() {
  const { leagueId } = yield select(get_app)
  yield call(api_get_draft, { leagueId })
}

export function* draft_player() {
  const { selected } = yield select(get_draft_state)
  const { teamId, leagueId } = yield select(get_app)
  const { uid } = yield select(get_rookie_draft_next_pick)
  const params = { leagueId, pid: selected, teamId, pickId: uid }
  yield call(api_post_draft, params)
}

export function* init() {
  const league = yield select(get_current_league)
  if (league.draft_start && constants.fantasy_season_week === 0) {
    yield call(api_get_draft, { leagueId: league.uid })
  }
}

//= ====================================
//  WATCHERS
// -------------------------------------

export function* watch_load_draft() {
  yield takeLatest(draft_actions.LOAD_DRAFT, load_draft)
}

export function* watch_draft_player() {
  yield takeLatest(draft_actions.DRAFT_PLAYER, draft_player)
}

export function* watch_auth_fulfilled() {
  yield takeLatest(app_actions.AUTH_FULFILLED, init)
}

//= ====================================
//  ROOT
// -------------------------------------

export const draft_sagas = [
  fork(watch_load_draft),
  fork(watch_draft_player),
  fork(watch_auth_fulfilled)
]
