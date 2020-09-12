import Auction from './auction'
import Scoreboard from './scoreboard'

const auctions = new Map()

module.exports = (wss) => {
  const scoreboard = new Scoreboard(wss)

  wss.on('connection', function (ws, request) {
    const { userId } = request.user
    ws.on('message', async (msg) => {
      const message = JSON.parse(msg)

      if (message.type === 'SCOREBOARD_REGISTER') {
        const { updated } = message.payload
        return scoreboard.register({ ws, userId, updated })
      }

      if (message.type !== 'AUCTION_JOIN') {
        return
      }

      const { lid, tid } = message.payload
      const auction = auctions.get(lid)

      const onclose = () => {
        const auction = auctions.get(lid)
        if (!Object.keys(auction._connected).length) {
          auctions.delete(lid)
        }
      }

      if (auction) {
        auction.join({ ws, tid, userId, onclose })
      } else {
        const auction = new Auction({ wss, lid })
        auctions.set(lid, auction)
        await auction.setup()
        auction.join({ ws, tid, userId, onclose })
      }
    })
  })
}
