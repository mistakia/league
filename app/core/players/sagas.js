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
import { transaction_types } from '#constants'

import { app_actions } from '@core/app'
import {
  get_app,
  get_router,
  get_player_maps,
  get_players_state,
  get_current_league,
  get_positions_for_current_league,
  get_sources_state,
  get_rosters_for_current_league,
  get_request_history
} from '@core/selectors'
import { notification_actions } from '@core/notifications'
import {
  api_get_cutlist,
  api_post_cutlist,
  api_get_team_players,
  api_get_league_players,
  api_get_players,
  api_get_all_players,
  api_search_players,
  api_get_player,
  api_put_setting,
  api_get_player_transactions,
  api_get_baselines,
  api_get_player_projections,
  api_get_player_gamelogs,
  api_get_player_seasonlogs,
  api_get_player_practices,
  api_get_player_betting_markets,
  api_get_player_content
} from '@core/api'
import { draft_actions } from '@core/draft'
import { player_actions } from './actions'
import { league_actions } from '@core/leagues'
import { source_actions } from '@core/sources'
import { roster_actions } from '@core/rosters'
import { auction_actions } from '@core/auction'
import DefaultPlayersViews from './default-players-views'

export function* load_all_players() {
  const state = yield select(get_players_state)
  const is_loaded = state.get('allPlayersLoaded', false)
  const is_pending = state.get('allPlayersPending', false)
  if (is_loaded || is_pending) return
  const { leagueId } = yield select(get_app)
  yield call(api_get_all_players, { leagueId })
}

export function* load_team_players({ payload }) {
  const { teamId, leagueId } = payload
  yield call(api_get_team_players, { teamId, leagueId })
}

export function* load_league_players() {
  const state = yield select(get_players_state)
  const is_loaded = state.get('leaguePlayersLoaded', false)
  const is_pending = state.get('leaguePlayersPending', false)
  if (is_loaded || is_pending) return
  const { leagueId } = yield select(get_app)
  yield call(api_get_league_players, { leagueId })
}

export function* search() {
  const { leagueId } = yield select(get_app)
  const players = yield select(get_players_state)
  const q = players.get('search')
  yield call(api_search_players, { q, leagueId })
}

// TODO disable this for now — do not need this on load
// export function* initLeaguePlayers() {
//   const league = yield select(get_current_league)
//   if (!league.processed_at) {
//     yield call(calculateValues)
//   }
// }

export function* calculateValues() {
  yield put(
    notification_actions.show({
      message: 'Calculating values'
    })
  )
  const { userId } = yield select(get_app)
  const league = yield select(get_current_league)
  const players = yield select(get_player_maps)
  const sources = yield select(get_sources_state)
  const roster_rows = (yield select(get_rosters_for_current_league))
    .toList()
    .toJS()

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
  const players = yield select(get_players_state)
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

export function* load_player({ payload }) {
  const { pid } = payload
  yield call(api_get_player, { pid })
}

export function* init({ payload }) {
  const app = yield select(get_app)
  const league = yield select(get_current_league)
  const router = yield select(get_router)

  // determine what players to load (all_active, league, team)
  // Default the position filter to the starting positions of the league in
  // VIEW. This used to be seeded in the reducer from `payload.data.leagues[0]`,
  // which is the user's lowest-numbered league rather than the one on screen,
  // so a manager in more than one league had the player list filtered by
  // another league's roster shape. `get_positions_for_current_league` resolves
  // it off `app.leagueId`, which the app reducer has already set by the time
  // this saga runs.
  if (league.league_id) {
    const positions = yield select(get_positions_for_current_league)
    yield put(player_actions.filter({ type: 'positions', values: positions }))
  }

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
    // The team and the league must be the pair the ROUTE names. Taking them
    // from `payload.data.teams[0]` and `payload.data.leagues[0]` paired two
    // independent queries by position, so for a manager in more than one
    // league it sent a team of one league with the id of another and
    // verify-user-team rejected it with `invalid leagueId`. Both are already
    // resolved in scope above.
    if (app.teamId && league.league_id) {
      yield fork(load_team_players, {
        payload: { teamId: app.teamId, leagueId: league.league_id }
      })
    }
  }
  if (league.league_id)
    yield fork(api_get_baselines, { leagueId: league.league_id })
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
      yield call(api_get_players, { leagueId, pids })
    }
  }
}

export function* put_watchlist({ payload }) {
  const players = yield select(get_players_state)
  const watchlist = players.get('watchlist').toArray()
  const plaintext = watchlist.toString()
  const params = { type: 'watchlist', value: plaintext }
  yield call(api_put_setting, params)
}

export function* fetch_cutlist() {
  const { teamId } = yield select(get_app)
  yield call(api_get_cutlist, { teamId })
}

export function* update_cutlist() {
  const players = yield select(get_players_state)
  const cutlist = players.get('cutlist').toArray()
  const { teamId, leagueId } = yield select(get_app)
  yield call(api_post_cutlist, { pids: cutlist, teamId, leagueId })
}

export function* cutlist_notification() {
  yield put(
    notification_actions.show({
      message: 'Updated Cutlist',
      severity: 'success'
    })
  )
}

export function* fetch_player_transactions({ payload }) {
  const { leagueId } = yield select(get_app)
  const { pid } = payload
  yield call(api_get_player_transactions, { pid, leagueId })
}

export function* fetch_player_projections({ payload }) {
  const { pid } = payload
  yield call(api_get_player_projections, { pid })
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
  yield call(api_get_player_gamelogs, { pid, params })
}

export function* load_player_seasonlogs({ payload }) {
  const { pid } = payload
  const { leagueId } = yield select(get_app)
  const params = { leagueId }
  yield call(api_get_player_seasonlogs, { pid, params })
}

export function* load_player_practices({ payload }) {
  const { pid } = payload
  yield call(api_get_player_practices, { pid })
}

export function* load_player_betting_markets({ payload }) {
  const { pid } = payload
  const request_history = yield select(get_request_history)
  const is_pending_or_fulfilled = request_history.get(
    `GET_PLAYER_BETTING_MARKETS_${pid}`
  )
  if (is_pending_or_fulfilled) return
  yield call(api_get_player_betting_markets, { pid })
}

export function* load_player_content({ payload }) {
  const { pid } = payload
  const request_history = yield select(get_request_history)
  const is_pending_or_fulfilled = request_history.get(
    `GET_PLAYER_CONTENT_${pid}`
  )
  if (is_pending_or_fulfilled) return
  yield call(api_get_player_content, { pid })
}

export function* load_missing_roster_players({ payload }) {
  const { leagueId } = yield select(get_app)
  const players_map = yield select((state) =>
    state.getIn(['players', 'items'], new Map())
  )
  const pids = []

  for (const roster of payload.data) {
    for (const item of roster.players) {
      if (!players_map.getIn([item.pid, 'first_name'])) {
        pids.push(item.pid)
      }
    }
  }

  if (pids.length) {
    yield call(api_get_players, { pids, leagueId })
  }
}

// THE NOMINATED PLAYER FETCHES ITS OWN RECORD, because the board's does not
// carry a birth date. `/api/players` -- the bulk endpoint every row on the
// auction board comes from -- does not select `date_of_birth` for anybody, so
// the bid bar rendered `AGE -` for the open nomination until something else
// happened to load the full player, which in practice meant opening the drawer
// and was therefore never true on first paint. `/api/players/:pid` is the only
// endpoint that carries the field.
//
// GUARDED ON THE FIELD, NOT ON THE PID, which buys two things. It skips the
// request outright when the drawer has already loaded that player, so a bidding
// war on one nomination costs one fetch rather than one per bid. And it cannot
// spin on a player whose birth date is genuinely unknown: that is stored as the
// string `0000-00-00` rather than as null, so the key reads truthy once the
// full record has landed and the guard closes either way.
//
// `first_name` is the fullness sentinel the roster hydration above uses, and it
// is the wrong one here -- the bulk endpoint DOES send first_name, so a check
// on it would pass for every board player and fetch nothing.
const nominated_pid_from = (payload) => {
  // AUCTION_BID carries the bid itself. AUCTION_INIT carries the transaction
  // log, and its head is a nomination only when it is an AUCTION_BID -- the
  // same test auction/reducer.js applies to set `nominated_pid`, kept identical
  // deliberately so the fetch and the render cannot disagree about who is up.
  if (payload.pid) return payload.pid
  const latest = payload.transactions && payload.transactions[0]
  return latest && latest.type === transaction_types.AUCTION_BID
    ? latest.pid
    : null
}

export function* load_nominated_player({ payload }) {
  const pid = nominated_pid_from(payload)
  if (!pid) return

  const players_map = yield select((state) =>
    state.getIn(['players', 'items'], new Map())
  )
  if (players_map.getIn([pid, 'date_of_birth'])) return

  yield call(api_get_player, { pid })
}

//= ====================================
//  WATCHERS
// -------------------------------------

export function* watch_auth_fulfilled() {
  yield takeLatest(app_actions.AUTH_FULFILLED, init)
}

export function* watch_auth_failed() {
  yield takeLatest(app_actions.AUTH_FAILED, load_all_players)
}

export function* watch_players_page_order() {
  yield takeLatest(player_actions.TOGGLE_PLAYERS_PAGE_ORDER, toggle_order)
}

export function* watch_draft_select_player() {
  yield takeLatest(draft_actions.DRAFT_SELECT_PLAYER, load_player)
}

export function* watch_select_player() {
  yield takeLatest(player_actions.PLAYERS_SELECT_PLAYER, load_player)
}

export function* watch_auction_select_player() {
  yield takeLatest(auction_actions.AUCTION_SELECT_PLAYER, load_player)
}

// Both entry points, because they are the two ways a nomination reaches a
// client and only one of them is the bug. AUCTION_INIT is the fresh load that
// rendered `AGE -`; AUCTION_BID is the socket path, which was already correct
// by the time anyone looked because the drawer had usually been opened. Missing
// either one leaves the field blank on exactly one of the two routes in.
export function* watch_auction_init_nominated_player() {
  yield takeLatest(auction_actions.AUCTION_INIT, load_nominated_player)
}

export function* watch_auction_bid_nominated_player() {
  yield takeLatest(auction_actions.AUCTION_BID, load_nominated_player)
}

export function* watch_set_league() {
  yield takeLatest(league_actions.SET_LEAGUE, calculateValues)
}

export function* watch_put_league_fulfilled() {
  yield takeLatest(league_actions.PUT_LEAGUE_FULFILLED, calculateValues)
}

export function* watch_set_source() {
  yield takeLatest(source_actions.SET_SOURCE, calculateValues)
}

export function* watch_put_source_fulfilled() {
  yield takeLatest(source_actions.PUT_SOURCE_FULFILLED, calculateValues)
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

export function* watch_load_player_seasonlogs() {
  yield takeLatest(
    player_actions.LOAD_PLAYER_SEASONLOGS,
    load_player_seasonlogs
  )
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

export function* watch_load_player_content() {
  yield takeLatest(player_actions.LOAD_PLAYER_CONTENT, load_player_content)
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

export const player_sagas = [
  fork(watch_auth_fulfilled),
  fork(watch_auth_failed),
  fork(watch_set_league),
  fork(watch_players_page_order),
  fork(watch_draft_select_player),
  fork(watch_select_player),
  fork(watch_put_league_fulfilled),
  fork(watch_set_source),
  fork(watch_put_source_fulfilled),
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
  fork(watch_load_player_seasonlogs),
  fork(watch_load_player_practices),
  fork(watch_load_player_betting_markets),
  fork(watch_load_player_content),
  fork(watch_load_all_players),
  fork(watch_load_league_players),
  fork(watch_load_team_players),
  fork(watch_auction_select_player),
  fork(watch_auction_init_nominated_player),
  fork(watch_auction_bid_nominated_player),
  // fork(watchFetchAllPlayersFulfilled),

  fork(watch_get_rosters_fulfilled)
]
