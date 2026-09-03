import { takeLatest, fork, select, delay, put, call } from 'redux-saga/effects'

import {
  get_player_maps,
  get_players_state,
  get_app,
  get_auction_state,
  get_current_league,
  get_rostered_player_ids_for_current_league,
  get_current_players_for_league,
  getPlayersForWatchlist
} from '@core/selectors'
import { auction_actions } from './actions'
import {
  api_get_auction_elections,
  api_post_auction_election,
  api_delete_auction_election,
  api_get_auction_blocks,
  api_post_auction_block_opt_in
} from '@core/api'
import { send, wsActions } from '@core/ws'
import { get_eligible_slots } from '#libs-shared'
import {
  fantasy_positions,
  player_id_regex,
  team_id_regex,
  starting_lineup_slot_league_keys,
  roster_slot_types,
  starter_slot_league_columns
} from '#constants'
import { beep } from '@core/audio'

export function* optimize() {
  const league = yield select(get_current_league)
  const watchlist = yield select(getPlayersForWatchlist)

  // make sure player values have been calculated
  const p_state = yield select(get_players_state)
  const baselines = p_state.get('baselines')
  if (!baselines.size) {
    return
  }

  const rostered_pids = yield select(get_rostered_player_ids_for_current_league)
  const sorted_watchlist = watchlist
    .filter((p_map) => !rostered_pids.includes(p_map.get('pid')))
    .sort(
      (a, b) =>
        b.getIn(['points', 'total'], 0) - a.getIn(['points', 'total'], 0)
    )
  const current_players = yield select(get_current_players_for_league)

  const default_limit = {
    fa: {
      max: current_players.roster.availableSpace
    },
    value: {
      // TODO - adjust based on bench depth
      max: Math.min(
        current_players.roster.availableCap,
        league.salary_cap * 0.8
      )
    }
  }

  const format_auction_player = (player_map) => ({
    pid: player_map.get('pid'),
    pos: player_map.get('primary_position'),
    market_salary: player_map.getIn(['market_salary', 'season'], 0),
    points: player_map.getIn(['points', '0', 'total'], 0)
  })

  // optimze lineup using current players and watchlist
  const { default: Worker } = yield call(
    () => import('workerize-loader?inline!../worker') // eslint-disable-line import/no-webpack-loader-syntax
  )
  const worker = new Worker()
  let result = yield call(worker.optimizeAuctionLineup, {
    limits: default_limit,
    players: sorted_watchlist.map(format_auction_player).toJS(),
    active: current_players.active.map(format_auction_player).toJS(),
    league
  })
  let starter_pids = Object.keys(result).filter(
    (r) => r.match(player_id_regex) || r.match(team_id_regex)
  )

  const roster_constraints = {}
  for (const pos of fantasy_positions) {
    roster_constraints[pos] = {
      max: get_eligible_slots({ pos, league }).length,
      min: league[starter_slot_league_columns[roster_slot_types[pos]]]
    }
  }

  const starter_limit = starting_lineup_slot_league_keys.reduce(
    (sum, key) => sum + (league[key] || 0),
    0
  )

  // if lineup incomplete, optimize with available players
  if (starter_pids.length < starter_limit) {
    const limits = {
      ...default_limit
    }
    for (const pid of starter_pids) {
      limits[pid] = { min: 1 }
    }

    const player_maps = yield select(get_player_maps)
    const available_players = player_maps
      .filter((p_map) => !rostered_pids.includes(p_map.get('pid')))
      .sort(
        (a, b) =>
          b.getIn(['points', 'total'], 0) - a.getIn(['points', 'total'], 0)
      )
      .toList()

    result = yield call(worker.optimizeAuctionLineup, {
      limits,
      players: available_players.map(format_auction_player).toJS(),
      active: current_players.active.map(format_auction_player).toJS(),
      league
    })
  }
  worker.terminate()
  starter_pids = Object.keys(result).filter(
    (r) => r.match(player_id_regex) || r.match(team_id_regex)
  )
  yield put(
    auction_actions.setOptimalLineup({
      pids: starter_pids,
      ...result
    })
  )
}

export function* join_auction({ type }) {
  // NO TEAM ID. The server resolves the acting team from the authenticated
  // session, so sending one here would be a value it is required to ignore.
  const { leagueId, clientId } = yield select(get_app)
  const message = {
    type,
    payload: { lid: leagueId, clientId }
  }
  // A REGISTRATION, so it may wait for the socket to open. AuctionControls
  // sends this from a mount effect that routinely wins the race against the
  // first connect, and on a first load nothing else would re-drive it -- there
  // is no close, so no WEBSOCKET_RECONNECTED and no `rejoin_auction`. The
  // server refuses a repeat on the same socket, and supersedes one from the
  // same user on a new socket, so a redundant join costs nothing.
  send(message, { queue_until_open: true })
}

/**
 * Re-join the auction after the websocket comes back.
 *
 * A JOIN IS PER SOCKET, AND A RECONNECT IS A NEW SOCKET. The server keys its
 * message handlers, its connected-team list and its AUCTION_INIT off the socket
 * that sent AUCTION_JOIN, so without this a manager who drops mid-block returns
 * to a page that still LOOKS live -- broadcasts keep arriving, because those are
 * filtered on the league id the query string carries -- while every bid and
 * nomination they send is dropped with no error, their team reads as
 * disconnected, and with pause_on_team_disconnect on the auction stays paused
 * for the whole league. The board also never catches up on what it missed while
 * the socket was down.
 */
export function* rejoin_auction() {
  const { is_joined } = yield select(get_auction_state)
  if (!is_joined) return

  yield call(join_auction, { type: auction_actions.AUCTION_JOIN })
}

export function* release_lock() {
  yield delay(1500)
  yield put(auction_actions.release())
}

export function* submit_bid({ payload }) {
  const { nominated_pid, bid } = yield select(get_auction_state)
  if (payload.value <= bid) {
    yield put(auction_actions.release())
    // TODO notify user
    return
  }

  const { value } = payload

  const message = {
    type: auction_actions.AUCTION_BID,
    payload: {
      pid: nominated_pid,
      value
    }
  }
  send(message)
  yield call(release_lock)
}

export function* submit_nomination({ payload }) {
  const { selected_pid } = yield select(get_auction_state)
  const { value } = payload
  const message = {
    type: auction_actions.AUCTION_SUBMIT_NOMINATION,
    payload: {
      value,
      pid: selected_pid
    }
  }
  send(message)
}

export function resume() {
  send({ type: auction_actions.AUCTION_RESUME })
}

export function pause() {
  send({ type: auction_actions.AUCTION_PAUSE })
}

export function* sound_notification() {
  const { muted } = yield select(get_auction_state)
  if (!muted) {
    beep()
  }
}

export function toggle_pause_on_team_disconnect() {
  send({ type: auction_actions.AUCTION_TOGGLE_PAUSE_ON_TEAM_DISCONNECT })
}

export function* load_auction_elections({ payload }) {
  yield call(api_get_auction_elections, payload)
}

export function* submit_auction_election({ payload }) {
  yield call(api_post_auction_election, payload)
}

export function* withdraw_auction_election({ payload }) {
  yield call(api_delete_auction_election, payload)
}

// The pair comes from the OPTS OF THE WRITE THAT JUST SUCCEEDED, not from a
// selector. Reading it from the league record is what broke this: `League` is an
// Immutable Record declaring `league_id`, so `leagueId` off it was always
// undefined and the guard below returned before the refetch on every write --
// which is why setting or withdrawing a maximum left the board chip, the
// standing-elections panel and the drawer control all frozen at their last
// loaded value. Refetching the exact pair that was written is also the only
// source that cannot disagree with the request.
export function* reload_auction_elections({ payload }) {
  const { leagueId, teamId } = payload.opts || {}
  if (!leagueId || !teamId) return
  yield call(api_get_auction_elections, { leagueId, teamId })
}

export function* load_auction_blocks({ payload }) {
  yield call(api_get_auction_blocks, payload)
}

export function* set_auction_block_opt_in({ payload }) {
  yield call(api_post_auction_block_opt_in, payload)
}

// The reducer drew the opt-in before the round trip, so a refusal leaves the
// calendar claiming something the server never recorded. Refetching is the
// rollback rather than inverting the click: a request can cover slots it did
// not change -- the hour-wide button sends all four quarters whatever their
// current state -- and inverting would then withdraw an opt-in the manager
// made earlier and still holds.
export function* reload_auction_blocks_after_failed_opt_in({ payload }) {
  const { leagueId } = payload.opts || {}
  if (!leagueId) return
  yield call(api_get_auction_blocks, { leagueId })
}

// The schedule is loaded when the auction page mounts rather than on the socket
// join, because opting into a block happens days before any block runs and the
// socket join is gated on the live window.
// `app.leagueId`, not a field on the league record: `League` declares
// `league_id`, so destructuring `leagueId` off it yields undefined and the guard
// swallows every refetch. Same defect as reload_auction_elections had.
export function* load_auction_blocks_for_current_league() {
  const { leagueId } = yield select(get_app)
  if (!leagueId) return
  yield call(api_get_auction_blocks, { leagueId })
}

//= ====================================
//  WATCHERS
// -------------------------------------

export function* watch_auction_join() {
  yield takeLatest(auction_actions.AUCTION_JOIN, join_auction)
}

export function* watch_websocket_reconnected() {
  yield takeLatest(wsActions.WEBSOCKET_RECONNECTED, rejoin_auction)
}

export function* watch_auction_submit_bid() {
  yield takeLatest(auction_actions.AUCTION_SUBMIT_BID, submit_bid)
}

export function* watch_auction_submit_nomination() {
  yield takeLatest(auction_actions.AUCTION_SUBMIT_NOMINATION, submit_nomination)
}

export function* watch_auction_bid() {
  yield takeLatest(auction_actions.AUCTION_BID, release_lock)
}

/* export function* watch_init_auction_lineup() {
 *   while (true) {
 *     yield all([
 *       take(player_actions.FETCH_ALL_PLAYERS_FULFILLED),
 *       take(auction_actions.AUCTION_JOIN)
 *     ])
 *     yield call(optimize)
 *   }
 * }
 *  */
/* export function* watch_toggle_watchlist() {
 *   yield takeLatest(player_actions.TOGGLE_WATCHLIST, optimize)
 * }
 *
 * export function* watch_set_auction_budget() {
 *   yield takeLatest(auction_actions.SET_AUCTION_BUDGET, optimize)
 * }
 *  */
export function* watch_auction_pause() {
  yield takeLatest(auction_actions.AUCTION_PAUSE, pause)
}

export function* watch_auction_resume() {
  yield takeLatest(auction_actions.AUCTION_RESUME, resume)
}

export function* watch_auction_start() {
  yield takeLatest(auction_actions.AUCTION_START, sound_notification)
}

export function* watch_auction_paused() {
  yield takeLatest(auction_actions.AUCTION_PAUSED, sound_notification)
}

export function* watch_load_auction_elections() {
  yield takeLatest(
    auction_actions.LOAD_AUCTION_ELECTIONS,
    load_auction_elections
  )
}

export function* watch_submit_auction_election() {
  yield takeLatest(
    auction_actions.SUBMIT_AUCTION_ELECTION,
    submit_auction_election
  )
}

export function* watch_withdraw_auction_election() {
  yield takeLatest(
    auction_actions.WITHDRAW_AUCTION_ELECTION,
    withdraw_auction_election
  )
}

// A settled election is removed from the standing list and gains an outcome, and
// the server owns both. Refetching the team's own rows after a write is cheaper
// and less error-prone than mirroring the settlement rules in the reducer.
export function* watch_post_auction_election_fulfilled() {
  yield takeLatest(
    auction_actions.POST_AUCTION_ELECTION_FULFILLED,
    reload_auction_elections
  )
}

export function* watch_delete_auction_election_fulfilled() {
  yield takeLatest(
    auction_actions.DELETE_AUCTION_ELECTION_FULFILLED,
    reload_auction_elections
  )
}

export function* watch_load_auction_blocks() {
  yield takeLatest(auction_actions.LOAD_AUCTION_BLOCKS, load_auction_blocks)
}

export function* watch_set_auction_block_opt_in() {
  yield takeLatest(
    auction_actions.SET_AUCTION_BLOCK_OPT_IN,
    set_auction_block_opt_in
  )
}

export function* watch_set_auction_block_opt_in_failed() {
  yield takeLatest(
    auction_actions.POST_AUCTION_BLOCK_OPT_IN_FAILED,
    reload_auction_blocks_after_failed_opt_in
  )
}

// A block convening changes what every OTHER client's calendar shows, and the
// opt-in write only returns the schedule to whoever sent it. The broadcast
// carries the schedule itself, so nothing refetches here -- but a mode
// transition does mean the final block has moved, and that is server-computed.
export function* watch_auction_mode() {
  yield takeLatest(
    auction_actions.AUCTION_MODE,
    load_auction_blocks_for_current_league
  )
}

export function* watch_auction_toggle_pause_on_team_disconnect() {
  yield takeLatest(
    auction_actions.AUCTION_TOGGLE_PAUSE_ON_TEAM_DISCONNECT,
    toggle_pause_on_team_disconnect
  )
}

//= ====================================
//  ROOT
// -------------------------------------

export const auction_sagas = [
  fork(watch_auction_join),
  fork(watch_websocket_reconnected),
  fork(watch_auction_submit_bid),
  fork(watch_auction_submit_nomination),
  fork(watch_auction_bid),
  // fork(watch_init_auction_lineup),
  // fork(watch_toggle_watchlist),
  // fork(watch_set_auction_budget),
  fork(watch_auction_pause),
  fork(watch_auction_resume),
  fork(watch_auction_start),
  fork(watch_auction_paused),
  fork(watch_auction_toggle_pause_on_team_disconnect),
  fork(watch_load_auction_elections),
  fork(watch_submit_auction_election),
  fork(watch_withdraw_auction_election),
  fork(watch_post_auction_election_fulfilled),
  fork(watch_delete_auction_election_fulfilled),
  fork(watch_load_auction_blocks),
  fork(watch_set_auction_block_opt_in),
  fork(watch_set_auction_block_opt_in_failed),
  fork(watch_auction_mode)
]
