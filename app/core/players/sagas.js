import { fork, takeLatest, call, select, put } from 'redux-saga/effects'

import { getApp, appActions } from '@core/app'
import { fetchPlayers, getPlayerStats, putProjection, delProjection } from '@core/api'
import { playerActions } from './actions'
import { getAllPlayers, getPlayers } from './selectors'
import { getLeagues, leagueActions } from '@core/leagues'
import { DEFAULT_ORDER_BY } from '@core/constants'
import { sourceActions, getSources } from '@core/sources'

export function * loadPlayers () {
  yield call(fetchPlayers)
}

export function * calculateValues () {
  const { userId } = yield select(getApp)
  const leagues = yield select(getLeagues)
  const players = yield select(getAllPlayers)
  const sources = yield select(getSources)

  yield put(playerActions.calculate({ players, leagues, sources: sources.toList(), userId }))
}

export function * toggleOrder ({ payload }) {
  const { orderBy } = payload
  const players = yield select(getPlayers)
  const currentOrderBy = players.get('orderBy')
  const currentOrder = players.get('order')
  if (orderBy === currentOrderBy) {
    if (currentOrder === 'asc') {
      yield put(playerActions.setOrder({
        order: 'desc',
        orderBy: DEFAULT_ORDER_BY
      }))
    } else {
      yield put(playerActions.setOrder({
        order: 'asc',
        orderBy
      }))
    }
  } else {
    yield put(playerActions.setOrder({
      order: 'desc',
      orderBy
    }))
  }
}

export function * setProjection ({ payload }) {
  const players = yield select(getPlayers)
  const week = players.get('week')
  const { value, type, playerId, userId } = payload
  yield call(putProjection, { value, type, playerId, userId, week })
  yield call(calculateValues)
}

export function * loadStats ({ payload }) {
  const { player } = payload
  yield call(getPlayerStats, { playerId: player })
}

export function * deleteProjection ({ payload }) {
  const { playerId } = payload
  const { userId } = yield select(getApp)
  const players = yield select(getPlayers)
  const week = players.get('week')
  yield call(delProjection, { playerId, userId, week })
  yield call(calculateValues)
}

//= ====================================
//  WATCHERS
// -------------------------------------

export function * watchLoadPlayers () {
  yield takeLatest(playerActions.LOAD_PLAYERS, loadPlayers)
}

export function * watchFetchPlayersFulfilled () {
  yield takeLatest(playerActions.FETCH_PLAYERS_FULFILLED, calculateValues)
}

export function * watchAuthFulfilled () {
  yield takeLatest(appActions.AUTH_FULFILLED, loadPlayers)
}

export function * watchToggleOrder () {
  yield takeLatest(playerActions.TOGGLE_ORDER, toggleOrder)
}

export function * watchSetProjection () {
  yield takeLatest(playerActions.SET_PROJECTION, setProjection)
}

export function * watchSelectPlayer () {
  yield takeLatest(playerActions.PLAYERS_SELECT_PLAYER, loadStats)
}

export function * watchPutLeagueFulfilled () {
  yield takeLatest(leagueActions.PUT_LEAGUE_FULFILLED, calculateValues)
}

export function * watchPutSourceFulfilled () {
  yield takeLatest(sourceActions.PUT_SOURCE_FULFILLED, calculateValues)
}

export function * watchDeleteProjection () {
  yield takeLatest(playerActions.DELETE_PROJECTION, deleteProjection)
}

//= ====================================
//  ROOT
// -------------------------------------

export const playerSagas = [
  fork(watchLoadPlayers),
  fork(watchFetchPlayersFulfilled),
  fork(watchAuthFulfilled),
  fork(watchToggleOrder),
  fork(watchSetProjection),
  fork(watchSelectPlayer),
  fork(watchPutLeagueFulfilled),
  fork(watchPutSourceFulfilled),
  fork(watchDeleteProjection)
]
