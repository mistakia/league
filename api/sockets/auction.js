import WebSocket from 'ws'
import config from '../../config'
import db from '../../db'
import { constants } from '../../common'

export default class Auction {
  constructor ({ wss, lid, room }) {
    this._wss = wss
    this._room = room
    this._lid = lid
    this._paused = true
    this._locked = false
    this._tids = []
    this._transactions = []
    this._ready = false
    this._connected = {}
  }

  has (tid) {
    return this._tids.includes(tid)
  }

  join ({ ws, tid, userId, onclose }) {
    if (this._connected[tid]) {
      this._connected[tid].push(userId)
    } else {
      this._connected[tid] = [userId]

      if (!this._ready && Object.keys(this._connected).length === this._tids.length) {
        this._ready = true
        this.start()
      }
    }

    ws.on('message', (msg) => {
      const message = JSON.parse(msg)
      if (message.type !== 'AUCTION_BID') {
        return
      }
      this.bid(message)
    })

    ws.on('close', () => {
      const index = this._connected[tid].indexOf(userId)
      this._connected[tid].splice(index, 1)

      if (!this._connected[tid].length) {
        delete this._connected[tid]
        this._ready = false
        this.pause()
      }

      onclose()
    })
  }

  broadcast (message) {
    this._wss.clients.forEach((c) => {
      if (c.upgradeReq.url === this._room) {
        if (c && c.readyState === WebSocket.OPEN) {
          c.send(message)
        }
      }
    })
  }

  async sold () {
    const bid = this._transactions[0]
    const { userid, tid, player, value, year } = bid
    const transaction = {
      userid,
      tid,
      player,
      type: constants.transactions.AUCTION_PROCESSED,
      value,
      year,
      timestamp: Math.round(Date.now() / 1000)
    }
    await db('transactions').insert(transaction)
    this.broadcast({
      type: 'AUCTION_PROCESSED',
      payload: transaction
    })
    this._startNominationTimer()
  }

  bid (message) {
    if (this._locked) return
    this._locked = true

    const { userid, tid, player, value } = message
    const current = this._transactions[0]

    if (current.player !== player) {
      // TODO announce error
      return
    }

    if (value > current.value) {
      // TODO announce error
      return
    }

    const bid = {
      userid,
      tid,
      player,
      type: constants.transactions.AUCTION_BID,
      value,
      year: constants.year,
      timestamp: Math.round(Date.now() / 1000)
    }
    db('transactions').insert(bid)
    this.broadcast({
      type: 'AUCTION_BID',
      payload: bid
    })
    this._startBidTimer()
  }

  nominate (message) {
    this._clearNominationTimer()

    if (!message) {
      // select player for nomination
    }

    const { userid, tid, player, value } = message
    const bid = {
      userid,
      tid,
      player,
      type: constants.transactions.AUCTION_BID,
      value,
      year: constants.year,
      timestamp: Math.round(Date.now() / 1000)
    }
    db('transactions').insert(bid)
    this.broadcast({
      type: 'AUCTION_BID',
      payload: bid
    })
    this._startBidTimer()
  }

  async setup () {
    this._teams = await db('teams').where('lid', this._lid)

    this._tids = this._teams.map(t => t.uid)
    this._transactions = await db('transactions')
      .whereIn('tid', this._tids)
      .where('year', constants.year)
      .orderBy('timestamp', 'desc')
  }

  start () {
    this._paused = false
    const latest = this._transactions[0]

    if (latest.type !== constants.transactions.AUCTION_BID) {
      this.broadcast({
        type: 'AUCTION_BID',
        payload: latest
      })
      this._startBidTimer()
    } else {
      this.broadcast({
        type: 'AUCTION_PROCESSED',
        payload: latest
      })
      this._startNominationTimer()
    }
  }

  pause () {
    this._clearTimers()
    this._paused = true
    this.broadcast({ type: 'AUCTION_PAUSED' })
  }

  _clearTimers () {
    this._clearNominationTimer()
    this._clearBidTimer()
  }

  _startNominationTimer () {
    this._clearNominationTimer()
    this._nominationTimer = setTimeout(() => this.nominate(), config.nominationTimeout)
  }

  _clearNominationTimer () {
    if (this._nominationTimer) clearTimeout(this._nominationTimer)
  }

  _startBidTimer () {
    this._clearBidTimer()
    this._bidTimer = setTimeout(() => this.sold(), config.bidTimer)
  }

  _clearBidTimer () {
    if (this._bidTimer) clearTimeout(this._bidTimer)
  }
}
