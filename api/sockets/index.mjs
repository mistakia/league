import Auction from './auction.mjs'
import Scoreboard from './scoreboard.mjs'

const auctions = new Map()

export default function (wss) {
  const scoreboard = new Scoreboard(wss)

  wss.on('connection', function (ws, request) {
    const { userId } = request.auth
    ws.on('message', async (msg) => {
      const message = JSON.parse(msg)

      if (message.type === 'SCOREBOARD_REGISTER') {
        const { updated } = message.payload
        return scoreboard.register({ ws, userId, updated })
      }

      if (message.type !== 'AUCTION_JOIN') {
        return
      }

      const { lid, tid, clientId } = message.payload
      const auction = auctions.get(lid)

      const onclose = () => {
        const auction = auctions.get(lid)
        if (!Object.keys(auction._connected).length) {
          auctions.delete(lid)
        }
      }

      if (auction) {
        auction.join({ ws, tid, userId, onclose, clientId })
      } else {
        const auction = new Auction({ wss, lid })
        auctions.set(lid, auction)
        await auction.setup()
        auction.join({ ws, tid, userId, onclose, clientId })
      }
    })
  })
}
