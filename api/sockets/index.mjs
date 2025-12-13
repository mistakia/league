import Auction from './auction.mjs'
import Scoreboard from './scoreboard.mjs'
import handle_data_view_socket from './data_view.mjs'
import handle_external_league_import_socket, {
  handle_client_disconnect,
  MESSAGE_TYPES
} from './external-league-import.mjs'
import { generate_client_id } from './utils.mjs'

const auctions = new Map()

export default function (wss) {
  const scoreboard = new Scoreboard(wss)
  handle_data_view_socket(wss)

  wss.on('connection', function (ws, request) {
    const user_id = request.auth ? request.auth.userId : null

    // Generate unique client ID for tracking
    ws.client_id = generate_client_id()

    // If the user is not authenticated do not need to handle any of the following messages
    if (!user_id) {
      return
    }

    ws.on('message', async (msg) => {
      const message = JSON.parse(msg)

      if (message.type === 'SCOREBOARD_REGISTER') {
        const { updated } = message.payload
        return scoreboard.register({ ws, user_id, updated })
      }

      if (message.type === 'AUCTION_JOIN') {
        const { lid, tid, clientId } = message.payload
        const auction = auctions.get(lid)

        const onclose = () => {
          const auction = auctions.get(lid)
          if (!Object.keys(auction._connected).length) {
            auctions.delete(lid)
          }
        }

        if (auction) {
          auction.join({ ws, tid, user_id, onclose, client_id: clientId })
        } else {
          const auction = new Auction({ wss, lid })
          auctions.set(lid, auction)
          await auction.setup()
          auction.join({ ws, tid, user_id, onclose, client_id: clientId })
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
        return handle_external_league_import_socket(ws, message)
      }
    })

    ws.on('close', () => {
      if (ws.client_id) {
        handle_client_disconnect(ws.client_id)
      }
    })
  })
}
