import WebSocket from 'ws'
import config from '../../config'
import db from '../../db'
import { constants, Roster, getEligibleSlots } from '../../common'
import debug from 'debug'

export default class Auction {
  constructor ({ wss, lid }) {
    this._wss = wss
    this._lid = lid
    this._league = null
    this._paused = true
    this._locked = false
    this._tids = []
    this._teams = []
    this._transactions = []
    this._ready = false
    this._connected = {}
    this.logger = debug(`league:${lid}:auction`)
  }

  get position () {
    return this._transactions.filter(t => t.type === constants.transactions.AUCTION_PROCESSED).length
  }

  has (tid) {
    return this._tids.includes(tid)
  }

  join ({ ws, tid, userId, onclose }) {
    this.logger(`userId ${userId} joined`)
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
      switch (message.type) {
        case 'AUCTION_BID':
          return this.bid(message.payload)

        case 'AUCTION_SUBMIT_NOMINATION':
          return this.nominate(message.payload)

        default:
          return console.log(`invalid message: ${message.type}`)
      }
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
    this.broadcast({
      type: 'AUCTION_INIT',
      payload: {
        transactions: this._transactions,
        tids: this._tids,
        teams: this._teams,
        bidTimer: config.bidTimer,
        nominationTimer: config.nominationTimer
      }
    })
  }

  broadcast (message) {
    this._wss.clients.forEach((c) => {
      if (c.leagueId === this._lid) {
        if (c && c.readyState === WebSocket.OPEN) {
          c.send(JSON.stringify(message))
        }
      }
    })
  }

  async sold () {
    this._locked = true
    const bid = this._transactions[0]
    const { userid, tid, player, value, year } = bid

    this.logger(`processing ${player} bid`)

    const rosters = await db('rosters')
      .where({ tid, year: constants.year })
      .orderBy('week', 'desc')

    const roster = new Roster(rosters[0])
    const players = await db('player').where('player', player)
    const playerInfo = players[0]
    if (!playerInfo) {
      // TODO broadcast error
      this.logger(`can not process invalid player ${player}`)
      return
    }

    const eligibleSlots = getEligibleSlots({
      pos: playerInfo.pos1,
      league: this._league,
      bench: true
    })
    const openSlots = roster.getOpenSlots(eligibleSlots)
    const slot = openSlots[0]
    if (!slot) {
      this.logger(`no open slots available for ${player} on teamId ${tid}`)
      // TODO broadcast error
      return
    }

    try {
      await db('rosters')
        .where({
          tid,
          week: rosters[0].week,
          year: constants.year
        })
        .update(`s${constants.slots[slot]}`, player)
    } catch (err) {
      this.logger(`unable to add player ${player} to roster of teamId ${tid}`)
      // TODO broadcast error
      return
    }

    const team = this._teams.find(t => t.uid === tid)
    const newCap = team.acap - value
    try {
      await db('teams').where({ tid }).update('acap', newCap)
    } catch (err) {
      this.logger('unable to update cap space')
      // TODO broadcast error
      return
    }

    this.broadcast({
      type: 'ROSTER_SLOT_UPDATED',
      payload: {
        tid,
        player,
        slot
      }
    })

    const transaction = {
      userid,
      tid,
      player,
      type: constants.transactions.AUCTION_PROCESSED,
      value,
      year,
      timestamp: Math.round(Date.now() / 1000)
    }
    const uid = await db('transactions').insert(transaction)
    this.broadcast({
      type: 'AUCTION_PROCESSED',
      payload: { ...transaction, uid }
    })
    this._transactions.unshift(transaction)
    this._startNominationTimer()
  }

  async bid (message) {
    if (this._locked) return
    this._locked = true

    const { userid, tid, player, value } = message
    const current = this._transactions[0]

    const team = this._teams.find(t => t.uid === tid)
    const newCap = team.acap - value
    if (newCap < 0) {
      // TODO broadcast error
      this._startBidTimer()
      this.logger(`team ${tid} does not have enough available cap ${team.acap} for a bid of ${value}`)
      this._locked = false
      return
    }

    this.logger(`received bid of ${value} for ${player} from teamId ${tid}`)

    if (current.player !== player) {
      this.logger(`received bid for player ${player} is not the current player of ${current.player}`)
      // TODO announce error
      this._startBidTimer()
      this._locked = false
      return
    }

    if (value <= current.value) {
      this.logger(`received bid of ${value} is not greater than current value of ${current.value}`)
      // TODO announce error
      this._startBidTimer()
      this._locked = false
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
    const uid = await db('transactions').insert(bid)
    this.broadcast({
      type: 'AUCTION_BID',
      payload: { ...bid, uid }
    })
    this._transactions.unshift(bid)
    this._startBidTimer()
    this._locked = false
  }

  async nominate (message = {}) {
    console.log(message)
    this._clearNominationTimer()

    const pos = this.position
    const tid = this._tids[pos % this._tids.length]
    const { userid, value = 1 } = message
    let { player } = message

    if (!player) {
      // select player for nomination
      const rows = await db('rosters')
        .select('*')
        .where({ lid: this._lid, year: constants.year })
        .distinct('tid', 'year')
        .orderBy('week', 'desc')

      const rosters = rows.map(r => new Roster(r))
      const players = rosters.map(r => r.players).flat()

      const results = await db('player')
        .innerJoin('draft_rankings', 'player.player', 'draft_rankings.player')
        .where('seas', constants.year)
        .orderBy('rank', 'asc')
        .whereNotIn('player.player', players)
        .limit(1)

      if (!results.length) {
        this.logger('no players available to nominate')
        // TODO announce error
        return
      }

      player = results[0].player
    } else {
      if (tid !== message.tid) {
        this.logger('received nomination from a team out of turn')
        // TODO announce error
        return
      }

      // TODO validate player eligibility
    }

    this.logger(`nominating ${player}`)

    const bid = {
      userid,
      tid,
      player,
      type: constants.transactions.AUCTION_BID,
      value,
      year: constants.year,
      timestamp: Math.round(Date.now() / 1000)
    }
    const uid = await db('transactions').insert(bid)
    this.broadcast({
      type: 'AUCTION_BID',
      payload: { ...bid, uid }
    })
    this._transactions.unshift(bid)
    this._locked = false
    this._startBidTimer()
  }

  async setup () {
    const teams = await db('teams').where('lid', this._lid)
    this._teams = teams.sort((a, b) => a.do - b.do)

    this._tids = this._teams.map(t => t.uid)
    this._transactions = await db('transactions')
      .whereIn('tid', this._tids)
      .where('year', constants.year)
      .whereIn('type', [
        constants.transactions.AUCTION_BID,
        constants.transactions.AUCTION_PROCESSED
      ])
      .orderBy('timestamp', 'desc')

    const leagues = await db('leagues').where('uid', this._lid)
    this._league = leagues[0]
  }

  start () {
    this.logger('starting auction')
    this._paused = false
    const latest = this._transactions[0]
    this.broadcast({
      type: 'AUCTION_START'
    })

    if (latest && latest.type === constants.transactions.AUCTION_BID) {
      this._startBidTimer()
    } else {
      this._startNominationTimer()
    }
  }

  pause () {
    this.logger('pausing auction')
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
    this.broadcast({
      type: 'AUCTION_POSITION',
      payload: {
        position: this.position
      }
    })
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
