import {
  fork,
  takeLatest,
  call,
  select,
  put,
  putResolve,
  debounce
} from 'redux-saga/effects'

import { getApp, getRouter, appActions } from '@core/app'
import { notificationActions } from '@core/notifications'
import {
  getCutlist,
  postCutlist,
  getTeamPlayers,
  getLeaguePlayers,
  fetchAllPlayers,
  searchPlayers,
  getPlayer,
  putProjection,
  delProjection,
  putSetting,
  getPlayerTransactions,
  getBaselines,
  getPlayerProjections,
  getPlayerGamelogs
} from '@core/api'
import { draftActions } from '@core/draft'
import { playerActions } from './actions'
import { auctionActions } from '@core/auction'
import { getAllPlayers, getPlayers } from './selectors'
import { leagueActions, getCurrentLeague } from '@core/leagues'
import { sourceActions, getSources } from '@core/sources'
import { getRostersForCurrentLeague, rosterActions } from '@core/rosters'
import Worker from 'workerize-loader?inline!../worker' // eslint-disable-line import/no-webpack-loader-syntax

export function* loadAllPlayers() {
  const state = yield select(getPlayers)
  const isLoaded = state.get('allPlayersLoaded', false)
  const isPending = state.get('allPlayersPending', false)
  if (isLoaded || isPending) return
  const { leagueId } = yield select(getApp)
  yield call(fetchAllPlayers, { leagueId })
}

export function* loadTeamPlayers() {
  const { teamId, leagueId } = yield select(getApp)
  yield call(getTeamPlayers, { teamId, leagueId })
}

export function* loadLeaguePlayers() {
  const state = yield select(getPlayers)
  const isLoaded = state.get('leaguePlayersLoaded', false)
  const isPending = state.get('leaguePlayersPending', false)
  if (isLoaded || isPending) return
  const { leagueId } = yield select(getApp)
  yield call(getLeaguePlayers, { leagueId })
}

export function* search() {
  const { leagueId } = yield select(getApp)
  const players = yield select(getPlayers)
  const q = players.get('search')
  yield call(searchPlayers, { q, leagueId })
}

export function* calculateValues() {
  yield put(
    notificationActions.show({
      message: 'Calculating values'
    })
  )
  const { userId } = yield select(getApp)
  const league = yield select(getCurrentLeague)
  const players = yield select(getAllPlayers)
  const sources = yield select(getSources)
  const rosterRows = (yield select(getRostersForCurrentLeague)).toList().toJS()

  const worker = new Worker()
  const result = yield call(worker.calculatePlayerValues, {
    players: players.valueSeq().toJS(),
    league,
    sources: sources.toList().toJS(),
    rosterRows,
    userId
  })
  worker.terminate()
  yield putResolve(playerActions.setValues(result))
  yield put(rosterActions.projectLineups())
  // TODO calculate bid up to values
}

export function* toggleOrder({ payload }) {
  const { orderBy } = payload
  const players = yield select(getPlayers)
  const currentOrderBy = players.get('orderBy')
  const currentOrder = players.get('order')
  if (orderBy === currentOrderBy) {
    if (currentOrder === 'asc') {
      yield put(
        playerActions.setOrder({
          order: 'desc',
          orderBy: 'vorp.ros' // TODO set based on view
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
  const { value, type, pid, userId, week } = payload
  if (token) yield call(putProjection, { value, type, pid, userId, week })
  else
    yield putResolve(
      playerActions.setProjection({ value, type, pid, userId, week })
    )
  yield call(calculateValues)
}

export function* loadPlayer({ payload }) {
  const { pid } = payload
  yield call(getPlayer, { pid })
}

export function* deleteProjection({ payload }) {
  const { pid, week } = payload
  const { userId, token } = yield select(getApp)
  if (token) yield call(delProjection, { userId, week, pid })
  else yield putResolve(playerActions.removeProjection({ pid, week }))
  yield call(calculateValues)
}

export function* init({ payload }) {
  const league = yield select(getCurrentLeague)
  const router = yield select(getRouter)
  const all_player_paths = ['/players', '/auction']
  const league_player_paths = ['/', '/dashboard', '/trade', '/league/rosters']
  const { pathname } = router.location
  if (all_player_paths.includes(pathname)) {
    yield fork(loadAllPlayers)
  } else if (league_player_paths.includes(pathname)) {
    yield fork(loadLeaguePlayers)
  } else {
    yield fork(loadTeamPlayers)
  }
  yield fork(getBaselines, { leagueId: league.uid })
  yield fork(fetchCutlist)

  const { watchlist } = payload.data.user
  if (watchlist) {
    try {
      const array = watchlist.split(',')
      yield put(playerActions.setWatchlist(array))
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

export function* fetchCutlist() {
  const { teamId } = yield select(getApp)
  yield call(getCutlist, { teamId })
}

export function* updateCutlist() {
  const players = yield select(getPlayers)
  const cutlist = players.get('cutlist').toArray()
  const { teamId, leagueId } = yield select(getApp)
  yield call(postCutlist, { pids: cutlist, teamId, leagueId })
}

export function* cutlistNotification() {
  yield put(
    notificationActions.show({
      message: 'Updated Cutlist',
      severity: 'success'
    })
  )
}

export function* fetchPlayerTransactions({ payload }) {
  const { leagueId } = yield select(getApp)
  const { pid } = payload
  yield call(getPlayerTransactions, { pid, leagueId })
}

export function* fetchPlayerProjections({ payload }) {
  const { pid } = payload
  yield call(getPlayerProjections, { pid })
}

export function* loadPlayerGamelogs({ payload }) {
  const { pid } = payload
  yield call(getPlayerGamelogs, { pid })
}

//= ====================================
//  WATCHERS
// -------------------------------------

export function* watchAuthFulfilled() {
  yield takeLatest(appActions.AUTH_FULFILLED, init)
}

export function* watchAuthFailed() {
  yield takeLatest(appActions.AUTH_FAILED, loadAllPlayers)
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

export function* watchAddCutlist() {
  yield takeLatest(playerActions.TOGGLE_CUTLIST, updateCutlist)
}

export function* watchReorderCutlist() {
  yield takeLatest(playerActions.REORDER_CUTLIST, updateCutlist)
}

export function* watchPostCutlistFulfilled() {
  yield takeLatest(playerActions.POST_CUTLIST_FULFILLED, cutlistNotification)
}

export function* watchGetPlayerTransactions() {
  yield takeLatest(
    playerActions.GET_PLAYER_TRANSACTIONS,
    fetchPlayerTransactions
  )
}

export function* watchGetPlayerProjections() {
  yield takeLatest(playerActions.GET_PLAYER_PROJECTIONS, fetchPlayerProjections)
}

export function* watchLoadPlayerGamelogs() {
  yield takeLatest(playerActions.LOAD_PLAYER_GAMELOGS, loadPlayerGamelogs)
}

export function* watchLoadAllPlayers() {
  yield takeLatest(playerActions.LOAD_ALL_PLAYERS, loadAllPlayers)
}

export function* watchLoadLeaguePlayers() {
  yield takeLatest(playerActions.LOAD_LEAGUE_PLAYERS, loadLeaguePlayers)
}

//= ====================================
//  ROOT
// -------------------------------------

export const playerSagas = [
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
  fork(watchAuctionProcessed),

  fork(watchSearchPlayers),

  fork(watchPutRostersFulfilled),
  fork(watchPostRostersFulfilled),
  fork(watchDeleteRostersFulfilled),

  fork(watchPostCutlistFulfilled),

  fork(watchAddCutlist),
  fork(watchReorderCutlist),

  fork(watchGetPlayerTransactions),
  fork(watchGetPlayerProjections),

  fork(watchLoadPlayerGamelogs),
  fork(watchLoadAllPlayers),
  fork(watchLoadLeaguePlayers)
]
