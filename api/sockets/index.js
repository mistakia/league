import db from '../../db'
import Auction from './auction'
import moment from 'moment'

const auctions = new Map()

module.exports = (wss) => {
  wss.on('connection', function (ws, request) {
    const { userId } = request.user
    ws.on('message', async (msg) => {
      const message = JSON.parse(msg)

      // TODO log

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
        const leagues = await db('leagues').where({ uid: lid })
        const league = leagues[0]
        if (!league.auction_start) {
          return
        }

        const now = moment()
        const auctionStart = moment(league.auction_start, 'X')
        const days = auctionStart.diff(now, 'days')
        // TODO log
        if (days > 0) {
          return
        }
        const auction = new Auction({ wss, lid, room: request.url })
        auctions.set(lid, auction)
        auction.join({ ws, tid, userId, onclose })
        auction.setup()
      }
    })
  })
}
