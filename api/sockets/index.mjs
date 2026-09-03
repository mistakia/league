import Auction from './auction.mjs'
import Scoreboard from './scoreboard.mjs'
import handle_data_view_socket from './data_view.mjs'
import handle_plays_view_socket from './plays_view.mjs'
import handle_external_league_import_socket, {
  handle_client_disconnect,
  MESSAGE_TYPES
} from './external-league-import.mjs'
import { generate_client_id } from './utils.mjs'
import debug from 'debug'

const log = debug('socket-index')
const auctions = new Map()

export default function (wss) {
  const scoreboard = new Scoreboard(wss)
  handle_data_view_socket(wss)
  handle_plays_view_socket(wss)

  wss.on('connection', function (ws, request) {
    const user_id = request.auth ? request.auth.userId : null

    // Generate unique client ID for tracking
    ws.client_id = generate_client_id()

    // If the user is not authenticated do not need to handle any of the following messages
    if (!user_id) {
      return
    }

    ws.on('message', async (msg) => {
      let message
      try {
        message = JSON.parse(msg)
      } catch (error) {
        log('Failed to parse message', { error: error.toString() })
        return
      }

      if (message.type === 'SCOREBOARD_REGISTER') {
        const { updated } = message.payload
        return scoreboard.register({ ws, user_id, updated })
      }

      if (message.type === 'AUCTION_JOIN') {
        // NO `tid`. The acting team is resolved inside `join` from `user_id`,
        // which came from `request.auth` rather than from this payload.
        const { lid, clientId } = message.payload
        const auction = auctions.get(lid)

        // THE AUCTION MAY ALREADY BE GONE, and dereferencing it here kills the
        // whole API process: this runs inside a `close` listener, so the
        // TypeError is an uncaughtException, and `install_process_handlers`
        // exits on those -- dropping every socket in every league.
        //
        // Reached whenever two sockets outlive each other across an emptying
        // auction, and the commissioner is the standing case: one who manages no
        // team joins deliberately (see `Auction.join`) and is never added to
        // `_connected`, so the last MANAGER leaving empties the map and deletes
        // the auction while the commissioner is still connected. Their close
        // then finds nothing. The websocket heartbeat makes this ordinary rather
        // than rare -- before it, a departed socket could sit ESTABLISHED for
        // long enough that the process restarted first.
        const onclose = () => {
          const auction = auctions.get(lid)
          if (!auction) return

          if (!Object.keys(auction._connected).length) {
            auctions.delete(lid)
          }
        }

        if (auction) {
          await auction.join({ ws, user_id, onclose, client_id: clientId })
        } else {
          const auction = new Auction({ wss, lid })
          auctions.set(lid, auction)
          await auction.setup()
          await auction.join({ ws, user_id, onclose, client_id: clientId })
        }
        return
      }

      // Route external league sync messages
      // Check for exact message types used by external league import socket
      const external_league_message_types = [
        MESSAGE_TYPES.QUEUE_SYNC_JOB,
        MESSAGE_TYPES.CANCEL_SYNC_JOB,
        MESSAGE_TYPES.GET_JOB_STATUS,
        MESSAGE_TYPES.GET_QUEUE_STATS,
        MESSAGE_TYPES.GET_CONNECTION_STATUS,
        MESSAGE_TYPES.VALIDATE_CONNECTION,
        MESSAGE_TYPES.SUBSCRIBE_TO_JOB,
        MESSAGE_TYPES.UNSUBSCRIBE_FROM_JOB
      ]
      if (external_league_message_types.includes(message.type)) {
        return handle_external_league_import_socket(ws, message, user_id)
      }
    })

    ws.on('close', () => {
      if (ws.client_id) {
        handle_client_disconnect(ws.client_id)
      }
    })
  })
}
