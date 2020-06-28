import { fork, takeLatest, call, select, put } from 'redux-saga/effects'

import { getApp, appActions } from '@core/app'
import { fetchPlayers, getPlayerStats } from '@core/api'
import { playerActions } from './actions'
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

export function * setProjection ({ payload }) {
  const { value, type, week, playerId, userId } = payload
  // TODO save projection
  yield call(calculateValues)
}

export function * loadStats ({ payload }) {
  const { player } = payload
  yield call(getPlayerStats, { playerId: player })
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

//= ====================================
//  ROOT
// -------------------------------------

export const playerSagas = [
  fork(watchLoadPlayers),
  fork(watchFetchPlayersFulfilled),
  fork(watchAuthFulfilled),
  fork(watchToggleOrder),
  fork(watchSetProjection),
  fork(watchSelectPlayer)
]
