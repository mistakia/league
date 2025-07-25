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
import { send } from '@core/ws'
import { constants, get_eligible_slots } from '@libs-shared'
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
      max: Math.min(current_players.roster.availableCap, league.cap * 0.8)
    }
  }

  const format_auction_player = (player_map) => ({
    pid: player_map.get('pid'),
    pos: player_map.get('pos'),
    market_salary: player_map.getIn(['market_salary', '0'], 0),
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
    (r) =>
      r.match(constants.player_pid_regex) || r.match(constants.team_pid_regex)
  )

  const roster_constraints = {}
  for (const pos of constants.positions) {
    roster_constraints[pos] = {
      max: get_eligible_slots({ pos, league }).length,
      min: league[`s${pos.toLowerCase()}`]
    }
  }

  const starter_limit = Object.keys(league)
    .filter((k) => k.startsWith('s'))
    .map((k) => league[k])
    .reduce((a, b) => a + b)

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
    (r) =>
      r.match(constants.player_pid_regex) || r.match(constants.team_pid_regex)
  )
  yield put(
    auction_actions.setOptimalLineup({
      pids: starter_pids,
      ...result
    })
  )
}

export function* join_auction({ type }) {
  const { leagueId, teamId, clientId } = yield select(get_app)
  const message = {
    type,
    payload: { lid: leagueId, tid: teamId, clientId }
  }
  send(message)
}

export function* release_lock() {
  yield delay(1500)
  yield put(auction_actions.release())
}

export function* submit_bid({ payload }) {
  const { userId, teamId } = yield select(get_app)
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
      userid: userId,
      tid: teamId,
      pid: nominated_pid,
      value
    }
  }
  send(message)
  yield call(release_lock)
}

export function* submit_nomination({ payload }) {
  const { userId, teamId } = yield select(get_app)
  const { selected_pid } = yield select(get_auction_state)
  const { value } = payload
  const message = {
    type: auction_actions.AUCTION_SUBMIT_NOMINATION,
    payload: {
      userid: userId,
      tid: teamId,
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

//= ====================================
//  WATCHERS
// -------------------------------------

export function* watch_auction_join() {
  yield takeLatest(auction_actions.AUCTION_JOIN, join_auction)
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

export function* watch_auction_toggle_pause_on_team_disconnect() {
  yield takeLatest(
    auction_actions.AUCTION_TOGGLE_PAUSE_ON_TEAM_DISCONNECT,
    toggle_pause_on_team_disconnect
  )
}

//= ====================================
//  ROOT
// -------------------------------------

// TODO - auto rejoin auction on websocket reconnection
export const auction_sagas = [
  fork(watch_auction_join),
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
  fork(watch_auction_toggle_pause_on_team_disconnect)
]
