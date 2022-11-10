import WebSocket from 'ws'
import config from '#config'
import db from '#db'
import { constants, Roster } from '#common'
import { getRoster, getLeague } from '#utils'
import debug from 'debug'

export default class Auction {
  constructor({ wss, lid }) {
    this._wss = wss
    this._lid = lid
    this._league = null
    this._paused = true
    this._pause_on_team_disconnect = true
    this._locked = false
    this._nominationTimerExpired = false
    this._tids = []
    this._teams = []
    this._transactions = []
    this._connected = {}
    this.logger = debug(`auction:league:${lid}`)
  }

  has(tid) {
    return this._tids.includes(tid)
  }

  get nominatingTeamId() {
    const lastTran = this._transactions[0]
    if (!lastTran) {
      return this._tids[0]
    }

    const lastNomination = this._transactions.find((tran, index) => {
      const prev = this._transactions[index + 1]
      return (
        tran.type === constants.transactions.AUCTION_BID &&
        (!prev || prev.type === constants.transactions.AUCTION_PROCESSED)
      )
    })

    this.logger(`last nominating teamId: ${lastNomination.tid}`)

    if (lastTran.type === constants.transactions.AUCTION_BID) {
      return lastNomination.tid
    } else {
      // starting with the tid of the last nomination
      const idx = this._tids.indexOf(lastNomination.tid)
      const list = this._tids
        .slice(idx + 1)
        .concat(this._tids.slice(0, idx + 1))
      for (const tid of list) {
        const team = this._teams.find((t) => t.uid === tid)
        if (team.availableSpace) {
          return team.uid
        }
      }
    }

    return null
  }

  join({ ws, tid, userId, onclose }) {
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

        case 'AUCTION_TOGGLE_PAUSE_ON_TEAM_DISCONNECT': {
          if (userId !== this._league.commishid) return
          this._pause_on_team_disconnect = !this._pause_on_team_disconnect
          return this.broadcast({
            type: 'AUCTION_CONFIG',
            payload: {
              pause_on_team_disconnect: this._pause_on_team_disconnect
            }
          })
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
        if (this._pause_on_team_disconnect) this.pause()
      }

      onclose()

      this.broadcast({
        type: 'AUCTION_CONNECTED',
        payload: {
          connected: Object.keys(this._connected).map((k) => parseInt(k, 10))
        }
      })
    })

    if (this._connected[tid]) {
      this._connected[tid].push(userId)
    } else {
      this._connected[tid] = [userId]
    }

    const nominatingTeamId = this.nominatingTeamId

    this.broadcast({
      type: 'AUCTION_INIT',
      payload: {
        transactions: this._transactions,
        paused: this._paused,
        tids: this._tids,
        teams: this._teams,
        connected: Object.keys(this._connected).map((k) => parseInt(k, 10)),
        bidTimer: config.bidTimer,
        nominationTimer: config.nominationTimer,
        nominatingTeamId,
        complete: !nominatingTeamId,
        pause_on_team_disconnect: this._pause_on_team_disconnect
      }
    })
  }

  reply(userId, message) {
    const event = {
      type: 'AUCTION_ERROR',
      payload: { error: message }
    }

    this._wss.clients.forEach((c) => {
      if (c.userId === userId) {
        if (c && c.readyState === WebSocket.OPEN) {
          c.send(JSON.stringify(event))
        }
      }
    })
  }

  broadcast(message) {
    this._wss.clients.forEach((c) => {
      if (c.leagueId === this._lid) {
        if (c && c.readyState === WebSocket.OPEN) {
          c.send(JSON.stringify(message))
        }
      }
    })
  }

  async sold() {
    this._locked = true
    const bid = this._transactions[0]
    const { userid, tid, pid, value, year } = bid

    this.logger(`processing ${pid} bid`)

    const players = await db('player').where('pid', pid)
    const playerInfo = players[0]
    if (!playerInfo) {
      this._startBidTimer()
      this.reply(userid, 'invalid player')
      this.logger(`can not process invalid player ${pid}`)
      return
    }

    const roster = await getRoster({ tid })

    const r = new Roster({ roster, league: this._league })
    const hasSlot = r.hasOpenBenchSlot(playerInfo.pos)
    if (!hasSlot) {
      this._startBidTimer()
      this.logger(`no open slots available for ${pid} on teamId ${tid}`)
      this.reply(userid, 'exceeds roster limits')
      return
    }

    if (r.availableCap - value < 0) {
      this._startBidTimer()
      this.logger('no available cap space')
      this.reply(userid, 'exceeds salary limit')
      return
    }

    try {
      await db('rosters_players').insert({
        rid: r.uid,
        slot: constants.slots.BENCH,
        pos: playerInfo.pos,
        pid,
        extensions: 0
      })
    } catch (err) {
      this.logger(err)
      this._startBidTimer()
      this.logger(`unable to add player ${pid} to roster of teamId ${tid}`)
      this.reply(userid, err.message)
      return
    }

    const team = this._teams.find((t) => t.uid === tid)
    team.availableSpace = team.availableSpace - 1
    const newCap = (team.cap = r.availableCap - value)
    try {
      await db('teams').where({ uid: tid }).update('cap', newCap)
    } catch (err) {
      this.logger(err)
      this.logger('unable to update cap space')
      this._startBidTimer()
      this.reply(userid, err.message)
      return
    }

    const transaction = {
      userid,
      tid,
      pid,
      lid: this._lid,
      type: constants.transactions.AUCTION_PROCESSED,
      value,
      week: 0,
      year,
      timestamp: Math.round(Date.now() / 1000)
    }
    const uid = await db('transactions').insert(transaction)
    this.broadcast({
      type: 'AUCTION_PROCESSED',
      payload: {
        rid: r.uid,
        pos: playerInfo.pos,
        uid,
        ...transaction
      }
    })
    this._transactions.unshift(transaction)
    this._startNominationTimer()
  }

  async bid(message) {
    if (this._locked) return
    this._locked = true

    const { userid, tid, pid, value } = message
    const current = this._transactions[0]

    const team = this._teams.find((t) => t.uid === tid)
    if (team.cap - value < 0) {
      this.reply(userid, 'exceeds salary limit')
      this._startBidTimer()
      this.logger(
        `team ${tid} does not have enough available cap ${team.cap} for a bid of ${value}`
      )
      this._locked = false
      return
    }

    if (!team.availableSpace) {
      this.reply(userid, 'exceeds roster limits')
      this._startBidTimer()
      this.logger(
        `team ${tid} does not have enough available space ${team.availableSpace}`
      )
      this._locked = false
      return
    }

    this.logger(`received bid of ${value} for ${pid} from teamId ${tid}`)

    if (current.pid !== pid) {
      this.logger(
        `received bid for player ${pid} is not the current player of ${current.pid}`
      )
      this.reply(userid, 'invalid bid')
      this._startBidTimer()
      this._locked = false
      return
    }

    if (value <= current.value) {
      this.logger(
        `received bid of ${value} is not greater than current value of ${current.value}`
      )
      this.reply(userid, 'invalid bid')
      this._startBidTimer()
      this._locked = false
      return
    }

    // TODO - verify reserve status for team

    const bid = {
      userid,
      tid,
      pid,
      lid: this._lid,
      type: constants.transactions.AUCTION_BID,
      value,
      week: 0,
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

  async nominate(message = {}, { userId, tid }) {
    const nominatingTeamId = this.nominatingTeamId
    let { userid, value = 0 } = message
    const { pid } = message

    if (!pid) {
      this.logger('no player to nominate')
      return
    }

    if (!this._nominationTimerExpired && nominatingTeamId !== tid) {
      this.logger('received nomination from a team out of turn')
      this.reply(userid, 'invalid nomination')
      return
    }

    const players = await db('player').where('pid', pid)
    const playerInfo = players[0]
    if (!playerInfo) {
      this.reply(userid, 'invalid nomination')
      this.logger(`can not nominate invalid player ${pid}`)
      return
    }

    // make sure player is not rostered
    const rosterRows = await db('rosters_players')
      .join('rosters', 'rosters_players.rid', 'rosters.uid')
      .where('lid', this._lid)
      .where('year', constants.season.year)
      .where('pid', pid)
    if (rosterRows.length) {
      this.reply(userid, 'invalid nomination')
      this.logger(`can not nominate invalid player ${pid}`)
      return
    }

    const roster = await getRoster({ tid: nominatingTeamId })

    const r = new Roster({ roster, league: this._league })
    const hasSlot = r.hasOpenBenchSlot(playerInfo.pos)
    if (!hasSlot) {
      this.logger(
        `no open slots available for ${pid} on teamId ${nominatingTeamId}`
      )
      this.reply(userid, 'exceeds roster limits')
      return
    }

    // make sure bid is within budget
    if (value > r.availableCap) {
      this.reply(userid, 'exceeds salary limit')
      return
    }

    this._clearNominationTimer()

    if (this._nominationTimerExpired && userId !== this._league.commishid) {
      this.logger('nomination timer expired')
      this.reply(userid, 'nomination timer has expired')
      return
    }

    if (this._nominationTimerExpired) {
      value = 0
    }

    this.logger(`nominating ${pid}`)

    const bid = {
      userid,
      tid: nominatingTeamId,
      pid,
      type: constants.transactions.AUCTION_BID,
      value,
      lid: this._lid,
      week: 0,
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

  async setup() {
    const teams = await db('teams').where('lid', this._lid)
    this._teams = teams.sort((a, b) => a.do - b.do)

    this._tids = this._teams.map((t) => t.uid)
    this._transactions = await db('transactions')
      .whereIn('tid', this._tids)
      .where('year', constants.season.year)
      .whereIn('type', [
        constants.transactions.AUCTION_BID,
        constants.transactions.AUCTION_PROCESSED
      ])
      .orderBy('timestamp', 'desc')
      .orderBy('uid', 'desc')

    this._league = await getLeague(this._lid)

    for (const team of this._teams) {
      const roster = await getRoster({ tid: team.uid })
      const r = new Roster({ roster, league: this._league })
      team.availableSpace = r.availableSpace
      team.cap = r.availableCap
    }
  }

  start() {
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

  pause() {
    if (this._paused) return
    this.logger('pausing auction')
    this._clearTimers()
    this._paused = true
    this.broadcast({ type: 'AUCTION_PAUSED' })
  }

  _clearTimers() {
    this._clearNominationTimer()
    this._clearBidTimer()
  }

  _startNominationTimer() {
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

  _clearNominationTimer() {
    if (this._nominationTimer) clearTimeout(this._nominationTimer)
  }

  _startBidTimer() {
    this._clearBidTimer()
    // padded by one second for connection latency
    this._bidTimer = setTimeout(() => this.sold(), config.bidTimer + 1000)
  }

  _clearBidTimer() {
    if (this._bidTimer) clearTimeout(this._bidTimer)
  }
}
