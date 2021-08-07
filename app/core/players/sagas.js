import {
  fork,
  takeLatest,
  call,
  select,
  put,
  putResolve,
  debounce
} from 'redux-saga/effects'

import { getApp, appActions } from '@core/app'
import { notificationActions } from '@core/notifications'
import {
  getCutlist,
  postCutlist,
  fetchPlayers,
  searchPlayers,
  getPlayer,
  getProjections,
  putProjection,
  delProjection,
  putSetting
} from '@core/api'
import { draftActions } from '@core/draft'
import { playerActions } from './actions'
import { auctionActions } from '@core/auction'
import { getAllPlayers, getPlayers } from './selectors'
import { leagueActions, getCurrentLeague } from '@core/leagues'
import { sourceActions, getSources } from '@core/sources'
import { settingActions } from '@core/settings'
import { getRostersForCurrentLeague, rosterActions } from '@core/rosters'
import Worker from 'workerize-loader?inline!../worker' // eslint-disable-line import/no-webpack-loader-syntax

export function* loadPlayers() {
  const { leagueId } = yield select(getApp)
  yield call(fetchPlayers, { leagueId })
}

export function* search() {
  const players = yield select(getPlayers)
  const q = players.get('search')
  yield call(searchPlayers, { q })
}

export function* loadProjections() {
  yield put(
    notificationActions.show({
      message: 'Loading Projections'
    })
  )
  yield fork(getProjections)
}

export function* calculateValues() {
  yield put(
    notificationActions.show({
      message: 'Calculating values'
    })
  )
  const { userId, vorpw, volsw } = yield select(getApp)
  const league = yield select(getCurrentLeague)
  const players = yield select(getAllPlayers)
  const sources = yield select(getSources)
  const baselines = (yield select(getPlayers)).get('baselines').toJS()
  const rosterRows = (yield select(getRostersForCurrentLeague)).toList().toJS()

  const worker = new Worker()
  const result = yield call(worker.calculatePlayerValues, {
    players: players.valueSeq().toJS(),
    league: league,
    sources: sources.toList().toJS(),
    rosterRows,
    baselines,
    userId,
    vorpw,
    volsw
  })
  worker.terminate()
  yield putResolve(playerActions.setValues(result))
  yield put(
    notificationActions.show({
      message: 'Projecting Lineups'
    })
  )
  yield put(rosterActions.projectLineups())
  // TODO calculate bid up to values
}

export function* toggleOrder({ payload }) {
  const { orderBy } = payload
  const app = yield select(getApp)
  const players = yield select(getPlayers)
  const currentOrderBy = players.get('orderBy')
  const currentOrder = players.get('order')
  if (orderBy === currentOrderBy) {
    if (currentOrder === 'asc') {
      yield put(
        playerActions.setOrder({
          order: 'desc',
          orderBy: `vorp.ros.${app.vbaseline}` // TODO set based on view
        })
      )
    } else {
      yield put(
        playerActions.setOrder({
          order: 'asc',
          orderBy
        })
      )
    }
  } else {
    yield put(
      playerActions.setOrder({
        order: 'desc',
        orderBy
      })
    )
  }
}

export function* saveProjection({ payload }) {
  const { token } = yield select(getApp)
  const { value, type, playerId, userId, week } = payload
  if (token) yield call(putProjection, { value, type, playerId, userId, week })
  else
    yield putResolve(
      playerActions.setProjection({ value, type, playerId, userId, week })
    )
  yield call(calculateValues)
}

export function* loadPlayer({ payload }) {
  const { player } = payload
  yield call(getPlayer, { playerId: player })
}

export function* deleteProjection({ payload }) {
  const { playerId, week } = payload
  const { userId, token } = yield select(getApp)
  if (token) yield call(delProjection, { userId, week, playerId })
  else yield putResolve(playerActions.removeProjection({ playerId, week }))
  yield call(calculateValues)
}

export function* init({ payload }) {
  yield fork(loadPlayers)
  const { watchlist } = payload.data.user
  if (watchlist) {
    try {
      const array = watchlist.split(',')
      const filtered = array.filter((p) => p.length === 7)
      yield put(playerActions.setWatchlist(filtered))
    } catch (err) {
      console.log(err)
    }
  }
}

export function* putWatchlist({ payload }) {
  const players = yield select(getPlayers)
  const watchlist = players.get('watchlist').toArray()
  const plaintext = watchlist.toString()
  const params = { type: 'watchlist', value: plaintext }
  yield call(putSetting, params)
}

export function* updateBaseline({ payload }) {
  const baselines = (yield select(getPlayers)).get('baselines').toJS()
  const { vbaseline } = yield select(getApp)
  const baseline = {}
  for (const b in baselines['0']) {
    baseline[b] = baselines['0'][b][vbaseline]
  }

  baseline[payload.position] = payload.value
  yield putResolve(settingActions.updateBaselines(baseline))
  yield put(settingActions.update({ type: 'vbaseline', value: 'manual' }))
}

export function* fetchCutlist() {
  const { teamId } = yield select(getApp)
  yield call(getCutlist, { teamId })
}

export function* updateCutlist() {
  const players = yield select(getPlayers)
  const cutlist = players.get('cutlist').toArray()
  const { teamId, leagueId } = yield select(getApp)
  yield call(postCutlist, { players: cutlist, teamId, leagueId })
}

export function* cutlistNotification() {
  yield put(
    notificationActions.show({
      message: 'Updated Cutlist',
      severity: 'success'
    })
  )
}

//= ====================================
//  WATCHERS
// -------------------------------------

export function* watchGetProjectionsFulfilled() {
  yield takeLatest(playerActions.GET_PROJECTIONS_FULFILLED, calculateValues)
}

export function* watchFetchPlayersFulfilled() {
  yield takeLatest(playerActions.FETCH_PLAYERS_FULFILLED, loadProjections)
}

export function* watchAuthFulfilled() {
  yield takeLatest(appActions.AUTH_FULFILLED, init)
}

export function* watchAuthFailed() {
  yield takeLatest(appActions.AUTH_FAILED, loadPlayers)
}

export function* watchToggleOrder() {
  yield takeLatest(playerActions.TOGGLE_ORDER, toggleOrder)
}

export function* watchSaveProjection() {
  yield takeLatest(playerActions.SAVE_PROJECTION, saveProjection)
}

export function* watchDraftSelectPlayer() {
  yield takeLatest(draftActions.DRAFT_SELECT_PLAYER, loadPlayer)
}

export function* watchSelectPlayer() {
  yield takeLatest(playerActions.PLAYERS_SELECT_PLAYER, loadPlayer)
}

export function* watchSetLeague() {
  yield takeLatest(leagueActions.SET_LEAGUE, calculateValues)
}

export function* watchPutLeagueFulfilled() {
  yield takeLatest(leagueActions.PUT_LEAGUE_FULFILLED, calculateValues)
}

export function* watchSetSource() {
  yield takeLatest(sourceActions.SET_SOURCE, calculateValues)
}

export function* watchPutSourceFulfilled() {
  yield takeLatest(sourceActions.PUT_SOURCE_FULFILLED, calculateValues)
}

export function* watchDeleteProjection() {
  yield takeLatest(playerActions.DELETE_PROJECTION, deleteProjection)
}

export function* watchToggleWatchlist() {
  yield takeLatest(playerActions.TOGGLE_WATCHLIST, putWatchlist)
}

export function* watchUpdateBaseline() {
  yield takeLatest(playerActions.UPDATE_PLAYER_BASELINE, updateBaseline)
}

export function* watchPutRostersFulfilled() {
  yield takeLatest(rosterActions.PUT_ROSTERS_FULFILLED, calculateValues)
}

export function* watchPostRostersFulfilled() {
  yield takeLatest(rosterActions.POST_ROSTERS_FULFILLED, calculateValues)
}

export function* watchDeleteRostersFulfilled() {
  yield takeLatest(rosterActions.DELETE_ROSTERS_FULFILLED, calculateValues)
}

export function* watchAuctionProcessed() {
  yield takeLatest(auctionActions.AUCTION_PROCESSED, calculateValues)
}

export function* watchSearchPlayers() {
  yield debounce(1000, playerActions.SEARCH_PLAYERS, search)
}

export function* watchGetCutlist() {
  yield takeLatest(playerActions.GET_CUTLIST, fetchCutlist)
}

export function* watchAddCutlist() {
  yield takeLatest(playerActions.TOGGLE_CUTLIST, updateCutlist)
}

export function* watchReorderCutlist() {
  yield takeLatest(playerActions.REORDER_CUTLIST, updateCutlist)
}

export function* watchPostCutlistFulfilled() {
  yield takeLatest(playerActions.POST_CUTLIST_FULFILLED, cutlistNotification)
}

//= ====================================
//  ROOT
// -------------------------------------

export const playerSagas = [
  fork(watchGetProjectionsFulfilled),
  fork(watchFetchPlayersFulfilled),
  fork(watchAuthFulfilled),
  fork(watchAuthFailed),
  fork(watchSetLeague),
  fork(watchToggleOrder),
  fork(watchSaveProjection),
  fork(watchDraftSelectPlayer),
  fork(watchSelectPlayer),
  fork(watchPutLeagueFulfilled),
  fork(watchSetSource),
  fork(watchPutSourceFulfilled),
  fork(watchDeleteProjection),
  fork(watchToggleWatchlist),
  fork(watchUpdateBaseline),
  fork(watchAuctionProcessed),

  fork(watchSearchPlayers),

  fork(watchPutRostersFulfilled),
  fork(watchPostRostersFulfilled),
  fork(watchDeleteRostersFulfilled),

  fork(watchPostCutlistFulfilled),

  fork(watchGetCutlist),
  fork(watchAddCutlist),
  fork(watchReorderCutlist)
]
