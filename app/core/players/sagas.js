import { fork, takeLatest, call, select, put } from 'redux-saga/effects'

import { getApp } from '@core/app'
import { fetchPlayers } from '@core/api'
import { playerActions } from './actions'
import { appActions } from '@core/app'
import { getAllPlayers, getPlayers } from './selectors'
import { getLeagues } from '@core/leagues'
import { DEFAULT_ORDER_BY } from '@core/constants'

export function * loadPlayers () {
  yield call(fetchPlayers)
}

export function * calculateValues () {
  const { userId } = yield select(getApp)
  const leagues = yield select(getLeagues)
  const players = yield select(getAllPlayers)

  yield put(playerActions.calculate({ players, leagues, userId }))
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

export function * setProjection () {
  // TODO save projection
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

//= ====================================
//  ROOT
// -------------------------------------

export const playerSagas = [
  fork(watchLoadPlayers),
  fork(watchFetchPlayersFulfilled),
  fork(watchAuthFulfilled),
  fork(watchToggleOrder),
  fork(watchSetProjection)
]
