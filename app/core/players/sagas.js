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
  getRostersForCurrentLeague,
  get_request_history
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
  get_player_transactions,
  getBaselines,
  get_player_projections,
  getPlayerGamelogs,
  getPlayerPractices,
  get_player_betting_markets
} from '@core/api'
import { draft_actions } from '@core/draft'
import { player_actions } from './actions'
import { leagueActions } from '@core/leagues'
import { sourceActions } from '@core/sources'
import { roster_actions } from '@core/rosters'
import { auctionActions } from '@core/auction'
import DefaultPlayersViews from './default-players-views'

export function* load_all_players() {
  const state = yield select(getPlayers)
  const is_loaded = state.get('allPlayersLoaded', false)
  const is_pending = state.get('allPlayersPending', false)
  if (is_loaded || is_pending) return
  const { leagueId } = yield select(get_app)
  yield call(fetchAllPlayers, { leagueId })
}

export function* load_team_players({ payload }) {
  const { teamId, leagueId } = payload
  yield call(getTeamPlayers, { teamId, leagueId })
}

export function* load_league_players() {
  const state = yield select(getPlayers)
  const is_loaded = state.get('leaguePlayersLoaded', false)
  const is_pending = state.get('leaguePlayersPending', false)
  if (is_loaded || is_pending) return
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
  const roster_rows = (yield select(getRostersForCurrentLeague)).toList().toJS()

  const { default: Worker } = yield call(
    () => import('workerize-loader?inline!../worker') // eslint-disable-line import/no-webpack-loader-syntax
  )
  const worker = new Worker()
  const result = yield call(worker.calculatePlayerValues, {
    players: players.valueSeq().toJS(),
    league,
    sources: sources.toList().toJS(),
    rosterRows: roster_rows,
    userId
  })
  worker.terminate()
  yield putResolve(player_actions.set_values(result))
  yield put(roster_actions.project_lineups())
  // TODO calculate bid up to values
}

export function* toggle_order({ payload }) {
  const { orderBy } = payload
  const players = yield select(getPlayers)
  const selected_view = players.get('selected_players_page_view')
  const current_order_by = players.get('orderBy')
  const current_order = players.get('order')
  if (orderBy === current_order_by) {
    if (current_order === 'asc') {
      const view_default_order_by = DefaultPlayersViews[selected_view].order_by
      yield put(
        player_actions.set_players_page_order({
          order: 'desc',
          orderBy: view_default_order_by
        })
      )
    } else {
      yield put(
        player_actions.set_players_page_order({
          order: 'asc',
          orderBy
        })
      )
    }
  } else {
    yield put(
      player_actions.set_players_page_order({
        order: 'desc',
        orderBy
      })
    )
  }
}

export function* save_projection({ payload }) {
  const { token } = yield select(get_app)
  const { value, type, pid, userId, week } = payload
  if (token) yield call(putProjection, { value, type, pid, userId, week })
  else
    yield putResolve(
      player_actions.set_projection({ value, type, pid, userId, week })
    )
  yield call(calculateValues)
}

export function* load_player({ payload }) {
  const { pid } = payload
  yield call(getPlayer, { pid })
}

export function* delete_projection({ payload }) {
  const { pid, week } = payload
  const { userId, token } = yield select(get_app)
  if (token) yield call(delProjection, { userId, week, pid })
  else yield putResolve(player_actions.remove_projection({ pid, week }))
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
    yield fork(load_all_players)
  } else if (is_league_player_path) {
    yield fork(load_league_players)
  } else {
    const team_id = (payload.data.teams[0] || {}).uid
    const league_id = (payload.data.leagues[0] || {}).uid
    yield fork(load_team_players, {
      payload: { teamId: team_id, leagueId: league_id }
    })
  }
  if (league.uid) yield fork(getBaselines, { leagueId: league.uid })
  if (app.teamId) yield fork(fetch_cutlist)

  const { watchlist } = payload.data.user
  if (watchlist) {
    try {
      const array = watchlist.split(',')
      yield put(player_actions.set_watchlist(array))
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

export function* put_watchlist({ payload }) {
  const players = yield select(getPlayers)
  const watchlist = players.get('watchlist').toArray()
  const plaintext = watchlist.toString()
  const params = { type: 'watchlist', value: plaintext }
  yield call(putSetting, params)
}

export function* fetch_cutlist() {
  const { teamId } = yield select(get_app)
  yield call(getCutlist, { teamId })
}

export function* update_cutlist() {
  const players = yield select(getPlayers)
  const cutlist = players.get('cutlist').toArray()
  const { teamId, leagueId } = yield select(get_app)
  yield call(postCutlist, { pids: cutlist, teamId, leagueId })
}

export function* cutlist_notification() {
  yield put(
    notificationActions.show({
      message: 'Updated Cutlist',
      severity: 'success'
    })
  )
}

export function* fetch_player_transactions({ payload }) {
  const { leagueId } = yield select(get_app)
  const { pid } = payload
  yield call(get_player_transactions, { pid, leagueId })
}

export function* fetch_player_projections({ payload }) {
  const { pid } = payload
  yield call(get_player_projections, { pid })
}

export function* load_player_gamelogs({ payload }) {
  const { pid, position } = payload
  const { leagueId } = yield select(get_app)
  const params = { leagueId }
  switch (position) {
    case 'QB':
      params.passing = true
      params.rushing = true
      break
    case 'RB':
      params.rushing = true
      params.receiving = true
      break
    case 'WR':
    case 'TE':
      params.receiving = true
      break
  }
  yield call(getPlayerGamelogs, { pid, params })
}

export function* load_player_practices({ payload }) {
  const { pid } = payload
  yield call(getPlayerPractices, { pid })
}

export function* load_player_betting_markets({ payload }) {
  const { pid } = payload
  const request_history = yield select(get_request_history)
  const is_pending_or_fulfilled = request_history.get(
    `GET_PLAYER_BETTING_MARKETS_${pid}`
  )
  if (is_pending_or_fulfilled) return
  yield call(get_player_betting_markets, { pid })
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

export function* watch_auth_fulfilled() {
  yield takeLatest(appActions.AUTH_FULFILLED, init)
}

export function* watch_auth_failed() {
  yield takeLatest(appActions.AUTH_FAILED, load_all_players)
}

export function* watch_players_page_order() {
  yield takeLatest(player_actions.TOGGLE_PLAYERS_PAGE_ORDER, toggle_order)
}

export function* watch_save_projection() {
  yield takeLatest(player_actions.SAVE_PROJECTION, save_projection)
}

export function* watch_draft_select_player() {
  yield takeLatest(draft_actions.DRAFT_SELECT_PLAYER, load_player)
}

export function* watch_select_player() {
  yield takeLatest(player_actions.PLAYERS_SELECT_PLAYER, load_player)
}

export function* watch_auction_select_player() {
  yield takeLatest(auctionActions.AUCTION_SELECT_PLAYER, load_player)
}

export function* watch_set_league() {
  yield takeLatest(leagueActions.SET_LEAGUE, calculateValues)
}

export function* watch_put_league_fulfilled() {
  yield takeLatest(leagueActions.PUT_LEAGUE_FULFILLED, calculateValues)
}

export function* watch_set_source() {
  yield takeLatest(sourceActions.SET_SOURCE, calculateValues)
}

export function* watch_put_source_fulfilled() {
  yield takeLatest(sourceActions.PUT_SOURCE_FULFILLED, calculateValues)
}

export function* watch_delete_projection() {
  yield takeLatest(player_actions.DELETE_PROJECTION, delete_projection)
}

export function* watch_toggle_watchlist() {
  yield takeLatest(player_actions.TOGGLE_WATCHLIST, put_watchlist)
}

export function* watch_put_rosters_fulfilled() {
  yield takeLatest(roster_actions.PUT_ROSTERS_FULFILLED, calculateValues)
}

export function* watch_post_rosters_fulfilled() {
  yield takeLatest(roster_actions.POST_ROSTERS_FULFILLED, calculateValues)
}

export function* watch_delete_rosters_fulfilled() {
  yield takeLatest(roster_actions.DELETE_ROSTERS_FULFILLED, calculateValues)
}

export function* watch_search_players() {
  yield debounce(1000, player_actions.SEARCH_PLAYERS, search)
}

export function* watch_add_cutlist() {
  yield takeLatest(player_actions.TOGGLE_CUTLIST, update_cutlist)
}

export function* watch_reorder_cutlist() {
  yield takeLatest(player_actions.REORDER_CUTLIST, update_cutlist)
}

export function* watch_post_cutlist_fulfilled() {
  yield takeLatest(player_actions.POST_CUTLIST_FULFILLED, cutlist_notification)
}

export function* watch_load_player_transactions() {
  yield takeLatest(
    player_actions.LOAD_PLAYER_TRANSACTIONS,
    fetch_player_transactions
  )
}

export function* watch_load_player_projections() {
  yield takeLatest(
    player_actions.LOAD_PLAYER_PROJECTIONS,
    fetch_player_projections
  )
}

export function* watch_load_player_gamelogs() {
  yield takeLatest(player_actions.LOAD_PLAYER_GAMELOGS, load_player_gamelogs)
}

export function* watch_load_player_practices() {
  yield takeLatest(player_actions.LOAD_PLAYER_PRACTICES, load_player_practices)
}

export function* watch_load_player_betting_markets() {
  yield takeLatest(
    player_actions.LOAD_PLAYER_BETTING_MARKETS,
    load_player_betting_markets
  )
}

export function* watch_load_all_players() {
  yield takeEvery(player_actions.LOAD_ALL_PLAYERS, load_all_players)
}

export function* watch_load_league_players() {
  yield takeLatest(player_actions.LOAD_LEAGUE_PLAYERS, load_league_players)
}

export function* watch_load_team_players() {
  yield takeLatest(player_actions.LOAD_TEAM_PLAYERS, load_team_players)
}

// export function* watchFetchAllPlayersFulfilled() {
//   yield takeLatest(player_actions.FETCH_ALL_PLAYERS_FULFILLED, initLeaguePlayers)
// }

export function* watch_get_rosters_fulfilled() {
  yield takeLatest(
    roster_actions.GET_ROSTERS_FULFILLED,
    load_missing_roster_players
  )
}

//= ====================================
//  ROOT
// -------------------------------------

export const playerSagas = [
  fork(watch_auth_fulfilled),
  fork(watch_auth_failed),
  fork(watch_set_league),
  fork(watch_players_page_order),
  fork(watch_save_projection),
  fork(watch_draft_select_player),
  fork(watch_select_player),
  fork(watch_put_league_fulfilled),
  fork(watch_set_source),
  fork(watch_put_source_fulfilled),
  fork(watch_delete_projection),
  fork(watch_toggle_watchlist),

  fork(watch_search_players),

  fork(watch_put_rosters_fulfilled),
  fork(watch_post_rosters_fulfilled),
  fork(watch_delete_rosters_fulfilled),

  fork(watch_post_cutlist_fulfilled),

  fork(watch_add_cutlist),
  fork(watch_reorder_cutlist),

  fork(watch_load_player_transactions),
  fork(watch_load_player_projections),

  fork(watch_load_player_gamelogs),
  fork(watch_load_player_practices),
  fork(watch_load_player_betting_markets),
  fork(watch_load_all_players),
  fork(watch_load_league_players),
  fork(watch_load_team_players),
  fork(watch_auction_select_player),
  // fork(watchFetchAllPlayersFulfilled),

  fork(watch_get_rosters_fulfilled)
]
