import { call, takeLatest, select, fork, delay, put } from 'redux-saga/effects'

import { wsActions } from './actions'
import { app_actions } from '@core/app'
import { get_app } from '@core/selectors'
import { openWS, closeWS, isOpen } from './service'

export function* disconnect() {
  yield call(closeWS)
}

export function* connect() {
  const { leagueId, token } = yield select(get_app)
  yield call(openWS, { token, leagueId })
}

export function* connect_auth() {
  // disconnect any existing connection and connect with auth
  yield call(disconnect)
  yield call(connect)

  // A DELIBERATE SWAP IS STILL A NEW SOCKET, and every per-socket registration
  // on the server died with the old one.
  //
  // Only an UNEXPECTED drop announced itself before this. `closeWS` detaches
  // `onclose` on purpose -- see service.js -- so the swap here dispatches no
  // WEBSOCKET_CLOSE, the reconnect loop never runs, and WEBSOCKET_RECONNECTED
  // was never put. That is the auction join lost on sign-in: AuctionControls
  // sends AUCTION_JOIN from a mount effect keyed on `is_logged_in`, so on the
  // ordering where the effect wins the race the join goes out on the socket
  // this function is about to discard -- or on the pre-auth one, where
  // `api/sockets/index.mjs` drops it unread because the connection carries no
  // user. Either way the authenticated socket that replaced it was never
  // joined, so no AUCTION_INIT ever arrived and the board sat at its
  // `isPaused` default reading `Auction is paused` on a running auction.
  //
  // `rejoin_auction` is guarded on this client having joined, so this is a
  // no-op for the ordinary sign-in that precedes opening the auction page, and
  // the redundant join on the ordering where the effect already reached the new
  // socket is refused by the same-socket branch in `Auction.join`.
  yield put(wsActions.reconnected())
}

const RECONNECT_BASE_DELAY = 1000
const RECONNECT_MAX_DELAY = 30000

// Exponential, capped, and jittered. The flat 2s retry this replaced was
// tolerable only while reconnect was gated on a signed-in user; now that every
// anonymous visitor reconnects too, a server restart would point the entire
// audience at a synchronized 2s loop and hold it there.
const reconnect_delay = (attempt) => {
  const backoff = Math.min(
    RECONNECT_BASE_DELAY * 2 ** attempt,
    RECONNECT_MAX_DELAY
  )
  return backoff / 2 + Math.random() * (backoff / 2)
}

export function* reconnect() {
  // Deliberately NOT gated on a signed-in user. The data-views page is
  // anonymously reachable, so a signed-out visitor used to get exactly one
  // socket for the life of the tab: once it dropped, every in-flight and
  // future request hung with no reconnect and no error.
  let attempt = 0
  while (!isOpen()) {
    yield call(connect)
    yield delay(reconnect_delay(attempt))
    attempt += 1
  }

  yield put(wsActions.reconnected())
}

//= ====================================
//  WATCHERS
// -------------------------------------

export function* watchLogout() {
  yield takeLatest(app_actions.LOGOUT, disconnect)
}

export function* watchAuthFulfilled() {
  yield takeLatest(app_actions.AUTH_FULFILLED, connect_auth)
}

export function* watchWebSocketClose() {
  yield takeLatest(wsActions.WEBSOCKET_CLOSE, reconnect)
}

export function* watch_init_app() {
  yield takeLatest(app_actions.INIT_APP, connect)
}

//= ====================================
//  ROOT
// -------------------------------------

export const ws_sagas = [
  fork(watchAuthFulfilled),
  fork(watchLogout),
  fork(watchWebSocketClose),
  fork(watch_init_app)
]
