import {
  fork,
  takeLatest,
  takeEvery,
  call,
  select,
  put,
  putResolve,
  debounce
} from 'redux-saga/effects'
import { Map } from 'immutable'

import { appActions } from '@core/app'
import {
  get_app,
  get_router,
  get_player_maps,
  getPlayers,
  getCurrentLeague,
  getSources,
  getRostersForCurrentLeague
} from '@core/selectors'
import { notificationActions } from '@core/notifications'
import {
  getCutlist,
  postCutlist,
  getTeamPlayers,
  getLeaguePlayers,
  fetchPlayers,
  fetchAllPlayers,
  searchPlayers,
  getPlayer,
  putProjection,
  delProjection,
  putSetting,
  getPlayerTransactions,
  getBaselines,
  getPlayerProjections,
  getPlayerGamelogs,
  getPlayerPractices
} from '@core/api'
import { draftActions } from '@core/draft'
import { playerActions } from './actions'
import { leagueActions } from '@core/leagues'
import { sourceActions } from '@core/sources'
import { rosterActions } from '@core/rosters'
import { auctionActions } from '@core/auction'
import DefaultPlayersViews from './default-players-views'

export function* loadAllPlayers() {
  const state = yield select(getPlayers)
  const isLoaded = state.get('allPlayersLoaded', false)
  const isPending = state.get('allPlayersPending', false)
  if (isLoaded || isPending) return
  const { leagueId } = yield select(get_app)
  yield call(fetchAllPlayers, { leagueId })
}

export function* loadTeamPlayers({ payload }) {
  const { teamId, leagueId } = payload
  yield call(getTeamPlayers, { teamId, leagueId })
}

export function* loadLeaguePlayers() {
  const state = yield select(getPlayers)
  const isLoaded = state.get('leaguePlayersLoaded', false)
  const isPending = state.get('leaguePlayersPending', false)
  if (isLoaded || isPending) return
  const { leagueId } = yield select(get_app)
  yield call(getLeaguePlayers, { leagueId })
}

export function* search() {
  const { leagueId } = yield select(get_app)
  const players = yield select(getPlayers)
  const q = players.get('search')
  yield call(searchPlayers, { q, leagueId })
}

// TODO disable this for now — do not need this on load
// export function* initLeaguePlayers() {
//   const league = yield select(getCurrentLeague)
//   if (!league.processed_at) {
//     yield call(calculateValues)
//   }
// }

export function* calculateValues() {
  yield put(
    notificationActions.show({
      message: 'Calculating values'
    })
  )
  const { userId } = yield select(get_app)
  const league = yield select(getCurrentLeague)
  const players = yield select(get_player_maps)
  const sources = yield select(getSources)
  const rosterRows = (yield select(getRostersForCurrentLeague)).toList().toJS()

  const { default: Worker } = yield call(
    () => import('workerize-loader?inline!../worker') // eslint-disable-line import/no-webpack-loader-syntax
  )
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
  const selected_view = players.get('selected_players_page_view')
  const currentOrderBy = players.get('orderBy')
  const currentOrder = players.get('order')
  if (orderBy === currentOrderBy) {
    if (currentOrder === 'asc') {
      const view_default_order_by = DefaultPlayersViews[selected_view].order_by
      yield put(
        playerActions.set_players_order({
          order: 'desc',
          orderBy: view_default_order_by
        })
      )
    } else {
      yield put(
        playerActions.set_players_order({
          order: 'asc',
          orderBy
        })
      )
    }
  } else {
    yield put(
      playerActions.set_players_order({
        order: 'desc',
        orderBy
      })
    )
  }
}

export function* saveProjection({ payload }) {
  const { token } = yield select(get_app)
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
  const { userId, token } = yield select(get_app)
  if (token) yield call(delProjection, { userId, week, pid })
  else yield putResolve(playerActions.removeProjection({ pid, week }))
  yield call(calculateValues)
}

export function* init({ payload }) {
  const app = yield select(get_app)
  const league = yield select(getCurrentLeague)
  const router = yield select(get_router)

  // determine what players to load (all_active, league, team)
  const { pathname } = router.location
  const all_player_paths = ['/players', '/auction']
  const league_player_paths = ['/', '/trade', 'rosters']
  const league_home_re = /\/leagues\/[0-9]+\/?$/
  const is_league_player_path = league_player_paths.find(
    (path) =>
      path === pathname ||
      pathname.includes(path) ||
      league_home_re.test(pathname)
  )
  const is_all_player_path = all_player_paths.find((path) =>
    pathname.includes(path)
  )
  if (is_all_player_path) {
    yield fork(loadAllPlayers)
  } else if (is_league_player_path) {
    yield fork(loadLeaguePlayers)
  } else {
    const teamId = (payload.data.teams[0] || {}).uid
    const leagueId = (payload.data.leagues[0] || {}).uid
    yield fork(loadTeamPlayers, { payload: { teamId, leagueId } })
  }
  yield fork(getBaselines, { leagueId: league.uid })
  if (app.teamId) yield fork(fetchCutlist)

  const { watchlist } = payload.data.user
  if (watchlist) {
    try {
      const array = watchlist.split(',')
      yield put(playerActions.setWatchlist(array))
    } catch (err) {
      console.log(err)
    }
  }

  if (payload.data.waivers.length || payload.data.poaches.length) {
    const pids = []
    payload.data.waivers.forEach((w) => pids.push(w.pid))
    payload.data.poaches.forEach((p) => pids.push(p.pid))
    const { leagueId } = yield select(get_app)
    if (pids.length) {
      yield call(fetchPlayers, { leagueId, pids })
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
  const { teamId } = yield select(get_app)
  yield call(getCutlist, { teamId })
}

export function* updateCutlist() {
  const players = yield select(getPlayers)
  const cutlist = players.get('cutlist').toArray()
  const { teamId, leagueId } = yield select(get_app)
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
  const { leagueId } = yield select(get_app)
  const { pid } = payload
  yield call(getPlayerTransactions, { pid, leagueId })
}

export function* fetchPlayerProjections({ payload }) {
  const { pid } = payload
  yield call(getPlayerProjections, { pid })
}

export function* loadPlayerGamelogs({ payload }) {
  const { pid } = payload
  const { leagueId } = yield select(get_app)
  yield call(getPlayerGamelogs, { pid, leagueId })
}

export function* loadPlayerPractices({ payload }) {
  const { pid } = payload
  yield call(getPlayerPractices, { pid })
}

export function* load_missing_roster_players({ payload }) {
  const { leagueId } = yield select(get_app)
  const players_map = yield select((state) =>
    state.getIn(['players', 'items'], new Map())
  )
  const pids = []

  for (const roster of payload.data) {
    for (const item of roster.players) {
      if (!players_map.getIn([item.pid, 'fname'])) {
        pids.push(item.pid)
      }
    }
  }

  if (pids.length) {
    yield call(fetchPlayers, { pids, leagueId })
  }
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

export function* watch_players_page_order() {
  yield takeLatest(playerActions.TOGGLE_PLAYERS_PAGE_ORDER, toggleOrder)
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

export function* watchAuctionSelectPlayer() {
  yield takeLatest(auctionActions.AUCTION_SELECT_PLAYER, loadPlayer)
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

export function* watchLoadPlayerPractices() {
  yield takeLatest(playerActions.LOAD_PLAYER_PRACTICES, loadPlayerPractices)
}

export function* watchLoadAllPlayers() {
  yield takeEvery(playerActions.LOAD_ALL_PLAYERS, loadAllPlayers)
}

export function* watchLoadLeaguePlayers() {
  yield takeLatest(playerActions.LOAD_LEAGUE_PLAYERS, loadLeaguePlayers)
}

export function* watchLoadTeamPlayers() {
  yield takeLatest(playerActions.LOAD_TEAM_PLAYERS, loadTeamPlayers)
}

// export function* watchFetchAllPlayersFulfilled() {
//   yield takeLatest(playerActions.FETCH_ALL_PLAYERS_FULFILLED, initLeaguePlayers)
// }

export function* watch_get_rosters_fulfilled() {
  yield takeLatest(
    rosterActions.GET_ROSTERS_FULFILLED,
    load_missing_roster_players
  )
}

//= ====================================
//  ROOT
// -------------------------------------

export const playerSagas = [
  fork(watchAuthFulfilled),
  fork(watchAuthFailed),
  fork(watchSetLeague),
  fork(watch_players_page_order),
  fork(watchSaveProjection),
  fork(watchDraftSelectPlayer),
  fork(watchSelectPlayer),
  fork(watchPutLeagueFulfilled),
  fork(watchSetSource),
  fork(watchPutSourceFulfilled),
  fork(watchDeleteProjection),
  fork(watchToggleWatchlist),

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
  fork(watchLoadPlayerPractices),
  fork(watchLoadAllPlayers),
  fork(watchLoadLeaguePlayers),
  fork(watchLoadTeamPlayers),
  fork(watchAuctionSelectPlayer),
  // fork(watchFetchAllPlayersFulfilled),

  fork(watch_get_rosters_fulfilled)
]
