import WebSocket from 'ws'
import config from '../../config'
import db from '../../db'
import { constants, Roster } from '../../common'
import { getRoster } from '../../utils'
import debug from 'debug'

export default class Auction {
  constructor ({ wss, lid }) {
    this._wss = wss
    this._lid = lid
    this._league = null
    this._paused = true
    this._locked = false
    this._nominationTimerExpired = false
    this._tids = []
    this._teams = []
    this._transactions = []
    this._ready = false
    this._connected = {}
    this.logger = debug(`auction:league:${lid}`)
  }

  has (tid) {
    return this._tids.includes(tid)
  }

  get nominatingTeamId () {
    const lastTran = this._transactions[0]
    if (!lastTran) {
      return this._tids[0]
    }

    const lastNomination = this._transactions.find((tran, index) => {
      const prev = this._transactions[index + 1]
      return tran.type === constants.transactions.AUCTION_BID &&
        (!prev || prev.type === constants.transactions.AUCTION_PROCESSED)
    })

    this.logger(`last nominating teamId: ${lastNomination.tid}`)

    if (lastTran.type === constants.transactions.AUCTION_BID) {
      return lastNomination.tid
    } else {
      // starting with the tid of the last nomination
      const idx = this._tids.indexOf(lastNomination.tid)
      const list = this._tids.slice(idx + 1).concat(this._tids.slice(0, idx))
      for (const tid of list) {
        const team = this._teams.find(t => t.uid === tid)
        if (team.availableSpace) {
          return team.uid
        }
      }
    }

    return null
  }

  join ({ ws, tid, userId, onclose }) {
    this.logger(`userId ${userId} joined`)
    ws.on('message', (msg) => {
      const message = JSON.parse(msg)
      switch (message.type) {
        case 'AUCTION_PAUSE': {
          if (userId !== this._league.commishid) return
          return this.pause()
        }

        case 'AUCTION_RESUME': {
          if (userId !== this._league.commishid) return
          return this.start()
        }

        case 'AUCTION_BID':
          return this.bid(message.payload)

        case 'AUCTION_SUBMIT_NOMINATION':
          return this.nominate(message.payload, { userId, tid })

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

      this.broadcast({
        type: 'AUCTION_CONNECTED',
        payload: {
          connected: Object.keys(this._connected).map(k => parseInt(k, 10))
        }
      })
    })

    let shouldStart = false
    if (this._connected[tid]) {
      this._connected[tid].push(userId)
    } else {
      this._connected[tid] = [userId]
      if (!this._ready && Object.keys(this._connected).length === this._tids.length) {
        shouldStart = true
      }
    }

    const nominatingTeamId = this.nominatingTeamId

    this.broadcast({
      type: 'AUCTION_INIT',
      payload: {
        transactions: this._transactions,
        paused: this._paused,
        ready: this._ready,
        tids: this._tids,
        teams: this._teams,
        connected: Object.keys(this._connected).map(k => parseInt(k, 10)),
        bidTimer: config.bidTimer,
        nominationTimer: config.nominationTimer,
        nominatingTeamId,
        complete: !nominatingTeamId
      }
    })

    if (shouldStart) {
      this._ready = true
      this.start()
    }
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

    const players = await db('player').where('player', player)
    const playerInfo = players[0]
    if (!playerInfo) {
      this._startBidTimer()
      // TODO broadcast error
      this.logger(`can not process invalid player ${player}`)
      return
    }

    const roster = await getRoster({ tid })

    const r = new Roster({ roster, league: this._league })
    const hasSlot = r.hasOpenBenchSlot(playerInfo.pos1)
    if (!hasSlot) {
      this._startBidTimer()
      this.logger(`no open slots available for ${player} on teamId ${tid}`)
      // TODO broadcast error
      return
    }

    if ((r.availableCap - value) < 0) {
      this._startBidTimer()
      this.logger('no available cap space')
      // TODO broadcast error
      return
    }

    try {
      await db('rosters_players')
        .insert({
          rid: r.uid,
          slot: constants.slots.BENCH,
          pos: playerInfo.pos1,
          player
        })
    } catch (err) {
      this.logger(err)
      this._startBidTimer()
      this.logger(`unable to add player ${player} to roster of teamId ${tid}`)
      // TODO broadcast error
      return
    }

    const team = this._teams.find(t => t.uid === tid)
    team.availableSpace = team.availableSpace - 1
    const newCap = team.cap = r.availableCap - value
    try {
      await db('teams').where({ uid: tid }).update('cap', newCap)
    } catch (err) {
      this.logger(err)
      this.logger('unable to update cap space')
      this._startBidTimer()
      // TODO broadcast error
      return
    }

    const transaction = {
      userid,
      tid,
      player,
      lid: this._lid,
      type: constants.transactions.AUCTION_PROCESSED,
      value,
      year,
      timestamp: Math.round(Date.now() / 1000)
    }
    const uid = await db('transactions').insert(transaction)
    this.broadcast({
      type: 'AUCTION_PROCESSED',
      payload: {
        rid: r.uid,
        pos: playerInfo.pos1,
        uid,
        ...transaction
      }
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
    const newCap = team.cap - value
    if (newCap < 0) {
      // TODO broadcast error
      this._startBidTimer()
      this.logger(`team ${tid} does not have enough available cap ${team.cap} for a bid of ${value}`)
      this._locked = false
      return
    }

    if (!team.availableSpace) {
      // TODO broadcast error
      this._startBidTimer()
      this.logger(`team ${tid} does not have enough available space ${team.availableSpace}`)
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
      lid: this._lid,
      type: constants.transactions.AUCTION_BID,
      value,
      year: constants.season.year,
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

  async nominate (message = {}, { userId, tid }) {
    const nominatingTeamId = this.nominatingTeamId
    let { userid, value = 0 } = message
    const { player } = message

    if (!player) {
      this.logger('no player to nominate')
      return
    }

    if (!this._nominationTimerExpired && nominatingTeamId !== tid) {
      this.logger('received nomination from a team out of turn')
      // TODO announce error
      return
    }

    // TODO validate player eligibility
    const players = await db('player').where('player', player)
    const playerInfo = players[0]
    if (!playerInfo) {
      // TODO broadcast error
      this.logger(`can not nominate invalid player ${player}`)
      return
    }

    const roster = await getRoster({ tid: nominatingTeamId })

    const r = new Roster({ roster, league: this._league })
    const hasSlot = r.hasOpenBenchSlot(playerInfo.pos1)
    if (!hasSlot) {
      this.logger(`no open slots available for ${player} on teamId ${nominatingTeamId}`)
      // TODO broadcast error
      return
    }

    this._clearNominationTimer()

    if (this._nominationTimerExpired && userId !== this._league.commishid) {
      this.logger('nomination timer expired')
      // TODO announce error
      return
    }

    if (this._nominationTimerExpired) {
      value = 0
    }

    this.logger(`nominating ${player}`)

    const bid = {
      userid,
      tid: nominatingTeamId,
      player,
      type: constants.transactions.AUCTION_BID,
      value,
      lid: this._lid,
      year: constants.season.year,
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
      .where('year', constants.season.year)
      .whereIn('type', [
        constants.transactions.AUCTION_BID,
        constants.transactions.AUCTION_PROCESSED
      ])
      .orderBy('timestamp', 'desc')
      .orderBy('uid', 'desc')

    const leagues = await db('leagues').where('uid', this._lid)
    this._league = leagues[0]

    for (const team of this._teams) {
      const roster = await getRoster({ tid: team.uid })
      const r = new Roster({ roster, league: this._league })
      team.availableSpace = r.availableSpace
      team.cap = r.availableCap
    }
  }

  start () {
    if (!this._paused) return
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
    if (this._paused) return
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
    this._nominationTimerExpired = false
    this._clearNominationTimer()
    const self = this
    const nominatingTeamId = this.nominatingTeamId
    if (!nominatingTeamId) {
      return this.broadcast({ type: 'AUCTION_COMPLETE' })
    }

    this.broadcast({
      type: 'AUCTION_NOMINATION_INFO',
      payload: {
        nominatingTeamId
      }
    })
    this._nominationTimer = setTimeout(() => {
      self._nominationTimerExpired = true
    }, config.nominationTimer)
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
