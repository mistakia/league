import { fork, takeLatest, call, select, put } from 'redux-saga/effects'
import AES from 'crypto-js/aes'
import UTF8 from 'crypto-js/enc-utf8'

import { getApp, appActions } from '@core/app'
import { fetchPlayers, getPlayerStats, putProjection, delProjection, putSetting } from '@core/api'
import { playerActions } from './actions'
import { getAllPlayers, getPlayers } from './selectors'
import { getLeagues, leagueActions } from '@core/leagues'
import { sourceActions, getSources } from '@core/sources'

export function * loadPlayers () {
  yield call(fetchPlayers)
}

export function * calculateValues () {
  const { userId, vorpw, volsw } = yield select(getApp)
  const leagues = yield select(getLeagues)
  const players = yield select(getAllPlayers)
  const sources = yield select(getSources)

  yield put(playerActions.calculate({ players, leagues, sources: sources.toList(), userId, vorpw, volsw }))
}

export function * toggleOrder ({ payload }) {
  const { orderBy } = payload
  const app = yield select(getApp)
  const players = yield select(getPlayers)
  const currentOrderBy = players.get('orderBy')
  const currentOrder = players.get('order')
  if (orderBy === currentOrderBy) {
    if (currentOrder === 'asc') {
      yield put(playerActions.setOrder({
        order: 'desc',
        orderBy: `vorp.${app.vbaseline}`
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

export function * init ({ payload }) {
  yield fork(loadPlayers)
  const { key } = yield select(getApp)
  const { watchlist } = payload.data.user
  if (watchlist) {
    const bytes = AES.decrypt(watchlist, key)
    const decryptedData = bytes.toString(UTF8).split(',')
    yield put(playerActions.setWatchlist(decryptedData))
  }
}

export function * putWatchlist ({ payload }) {
  const { key } = yield select(getApp)
  const players = yield select(getPlayers)
  const watchlist = players.get('watchlist').toArray()
  const plaintext = watchlist.toString()
  const encrypted = AES.encrypt(plaintext, key).toString()
  const params = { type: 'watchlist', value: encrypted }
  yield call(putSetting, params)
}

//= ====================================
//  WATCHERS
// -------------------------------------

export function * watchLoadPlayers () {
  yield takeLatest(playerActions.LOAD_PLAYERS, loadPlayers) // TODO - remove?
}

export function * watchFetchPlayersFulfilled () {
  yield takeLatest(playerActions.FETCH_PLAYERS_FULFILLED, calculateValues)
}

export function * watchAuthFulfilled () {
  yield takeLatest(appActions.AUTH_FULFILLED, init)
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

export function * watchToggleWatchlist () {
  yield takeLatest(playerActions.TOGGLE_WATCHLIST, putWatchlist)
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
  fork(watchDeleteProjection),
  fork(watchToggleWatchlist)
]
