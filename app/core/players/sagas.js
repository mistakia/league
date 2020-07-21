import { fork, takeLatest, call, select, put, putResolve } from 'redux-saga/effects'
import AES from 'crypto-js/aes'
import UTF8 from 'crypto-js/enc-utf8'

import { getApp, appActions } from '@core/app'
import { fetchPlayers, getPlayerStats, putProjection, delProjection, putSetting } from '@core/api'
import { playerActions } from './actions'
import { getAllPlayers, getPlayers } from './selectors'
import { leagueActions, getCurrentLeague } from '@core/leagues'
import { sourceActions, getSources } from '@core/sources'
import { settingActions } from '@core/settings'
import Worker from 'workerize-loader?inline!./worker' // eslint-disable-line import/no-webpack-loader-syntax

export function * loadPlayers () {
  yield call(fetchPlayers)
}

export function * calculateValues () {
  const { userId, vorpw, volsw } = yield select(getApp)
  const league = yield select(getCurrentLeague)
  const players = yield select(getAllPlayers)
  const sources = yield select(getSources)
  const baselines = (yield select(getPlayers)).get('baselines').toJS()

  const worker = new Worker()
  const result = yield call(worker.calculatePlayerValues, {
    players: players.valueSeq().toJS(),
    league: league,
    sources: sources.toList().toJS(),
    baselines,
    userId,
    vorpw,
    volsw
  })
  yield put(playerActions.setValues(result))
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

export function * saveProjection ({ payload }) {
  const { token } = yield select(getApp)
  const players = yield select(getPlayers)
  const week = players.get('week')
  const { value, type, playerId, userId } = payload
  if (token) yield call(putProjection, { value, type, playerId, userId, week })
  else yield put(playerActions.setProjection({ value, type, playerId, userId, week }))
  yield call(calculateValues)
}

export function * loadStats ({ payload }) {
  const { player } = payload
  yield call(getPlayerStats, { playerId: player })
}

export function * deleteProjection ({ payload }) {
  const { playerId } = payload
  const { userId, token } = yield select(getApp)
  const players = yield select(getPlayers)
  const week = players.get('week')
  if (token) yield call(delProjection, { playerId, userId, week })
  else yield put(playerActions.removeProjection({ playerId }))
  yield call(calculateValues)
}

export function * init ({ payload }) {
  yield fork(loadPlayers)
  const { key } = yield select(getApp)
  const { watchlist } = payload.data.user
  if (watchlist) {
    const bytes = AES.decrypt(watchlist, key)
    const decryptedData = bytes.toString(UTF8).split(',')
    const cleaned = decryptedData.filter(p => !!p)
    yield put(playerActions.setWatchlist(cleaned))
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

export function * updateBaseline ({ payload }) {
  const baselines = (yield select(getPlayers)).get('baselines').toJS()
  const { vbaseline } = yield select(getApp)
  const baseline = {}
  for (const b in baselines) {
    baseline[b] = baselines[b][vbaseline]
  }

  baseline[payload.position] = payload.value
  yield putResolve(settingActions.updateBaselines(baseline))
  yield put(settingActions.update({ type: 'vbaseline', value: 'manual' }))
}

//= ====================================
//  WATCHERS
// -------------------------------------

export function * watchFetchPlayersFulfilled () {
  yield takeLatest(playerActions.FETCH_PLAYERS_FULFILLED, calculateValues)
}

export function * watchAuthFulfilled () {
  yield takeLatest(appActions.AUTH_FULFILLED, init)
}

export function * watchToggleOrder () {
  yield takeLatest(playerActions.TOGGLE_ORDER, toggleOrder)
}

export function * watchSaveProjection () {
  yield takeLatest(playerActions.SAVE_PROJECTION, saveProjection)
}

export function * watchSelectPlayer () {
  yield takeLatest(playerActions.PLAYERS_SELECT_PLAYER, loadStats)
}

export function * watchSetLeague () {
  yield takeLatest(leagueActions.SET_LEAGUE, calculateValues)
}

export function * watchPutLeagueFulfilled () {
  yield takeLatest(leagueActions.PUT_LEAGUE_FULFILLED, calculateValues)
}

export function * watchSetSource () {
  yield takeLatest(sourceActions.SET_SOURCE, calculateValues)
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

export function * watchInitApp () {
  yield takeLatest(appActions.INIT_APP, loadPlayers)
}

export function * watchUpdateBaseline () {
  yield takeLatest(playerActions.UPDATE_PLAYER_BASELINE, updateBaseline)
}

//= ====================================
//  ROOT
// -------------------------------------

export const playerSagas = [
  fork(watchInitApp),
  fork(watchFetchPlayersFulfilled),
  fork(watchAuthFulfilled),
  fork(watchSetLeague),
  fork(watchToggleOrder),
  fork(watchSaveProjection),
  fork(watchSelectPlayer),
  fork(watchPutLeagueFulfilled),
  fork(watchSetSource),
  fork(watchPutSourceFulfilled),
  fork(watchDeleteProjection),
  fork(watchToggleWatchlist),
  fork(watchUpdateBaseline)
]
