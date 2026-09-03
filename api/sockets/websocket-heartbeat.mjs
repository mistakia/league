import debug from 'debug'

const log = debug('socket-heartbeat')

// HOW LONG A DEAD SOCKET STAYS INDISTINGUISHABLE FROM AN IDLE ONE.
//
// A phone that changes network, sleeps, or walks out of range sends no FIN, so
// the connection stays ESTABLISHED on this side until TCP gives up -- which is
// minutes at best and, on a connection with nothing to retransmit, effectively
// never. Until then the socket is in `wss.clients` at readyState OPEN, the
// auction counts its team as present, and everything broadcast to it is written
// into a hole.
//
// THE CLIENT'S OWN KEEPALIVE CANNOT ANSWER THIS. `app/core/ws/service.js` sends
// a KEEPALIVE message every 30 seconds, but it is one-directional: its absence
// is not something this side watches for, and it stops arriving for a
// backgrounded tab whose timers the browser has frozen -- a tab that is very
// much still connected. A protocol ping is the read that distinguishes them,
// because the browser answers it from the socket itself rather than from script,
// so a frozen tab still pongs and a dead connection still does not.
//
// One missed pong is the threshold rather than several: the auction's whole
// disconnect story -- auto-pause, the connected-team list, and the reconnect
// supersession in `auction.mjs` -- wants to hear about a departure in seconds,
// and a false positive costs a client one reconnect it already knows how to
// perform.
export const HEARTBEAT_INTERVAL_MS = 30_000

/**
 * Ping every client on an interval and terminate whichever did not pong.
 *
 * EXTRACTED FROM `api/index.mjs` SO IT CAN BE ASSERTED ON. At module scope
 * beside the server it ran on a real `setInterval` against a real
 * `WebSocket.Server`, so there was no seam to drive it from and the one fix of
 * the four with no observable in the suite was this one. `timers` is injected
 * for the same reason `Auction` takes its clock that way.
 *
 * NAMED `websocket-heartbeat` rather than `heartbeat`: a filename has to carry
 * its meaning without its directory, and `libs-server/data-views` already has an
 * unrelated heartbeat of its own.
 *
 * `terminate` rather than `close`: a socket that missed a ping is one this side
 * has no reason to believe is reachable, and a close handshake waits for a peer
 * that is gone. It still fires the `close` handlers the auction registers, which
 * is what makes the departure observable at all.
 *
 * @param {object} args
 * @param {object} args.wss - the WebSocket.Server whose clients to sweep
 * @param {number} [args.interval_ms]
 * @param {{set_interval: Function, clear_interval: Function}} [args.timers]
 * @returns {() => void} stops the sweep -- call it when the server closes
 */
export const install_websocket_heartbeat = ({
  wss,
  interval_ms = HEARTBEAT_INTERVAL_MS,
  timers = {
    set_interval: (fn, ms) => setInterval(fn, ms),
    clear_interval: (handle) => clearInterval(handle)
  }
}) => {
  wss.on('connection', (ws) => {
    ws.is_alive = true
    ws.on('pong', () => {
      ws.is_alive = true
    })
  })

  const sweep = () => {
    wss.clients.forEach((ws) => {
      // `=== false` rather than falsy, so a socket that has not been swept yet
      // -- `is_alive` undefined, which is every client of a server this was
      // installed on AFTER it started serving -- is pinged rather than killed.
      if (ws.is_alive === false) {
        log('terminating a socket that missed its pong')
        return ws.terminate()
      }

      ws.is_alive = false
      ws.ping()
    })
  }

  const handle = timers.set_interval(sweep, interval_ms)

  // `wss.on('close')` is NOT a reliable stop signal for a `noServer` server --
  // nothing emits it unless `wss.close()` is called explicitly -- so the caller
  // gets the stopper and the interval is not left to an event that may never
  // fire. Returned rather than registered for the same reason a spec needs it.
  return () => timers.clear_interval(handle)
}

export default install_websocket_heartbeat
