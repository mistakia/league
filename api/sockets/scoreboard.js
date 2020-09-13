const WebSocket = require('ws')
const debug = require('debug')

const db = require('../../db')
const { constants } = require('../../common')

const wait = ms => new Promise(resolve => setTimeout(resolve, ms))

export default class Scoreboard {
  constructor (wss) {
    this._wss = wss
    this._isPolling = false
    this._users = new Map()
    this._log = debug('scoreboard')
  }

  register ({ ws, userId, updated }) {
    this._log(`registering userId(${userId}) for scoreboard updates`)
    this._users.set(userId, updated)
    ws.on('close', () => this._users.delete(userId))
    if (!this._isPolling) this.poll()
  }

  async poll () {
    // TODO - only poll while games are pending
    this._log('polling for scoreboard updates')
    this._isPolling = true
    const updateTimestamps = Array.from(this._users.values()).sort((a, b) => a - b)
    const updated = updateTimestamps[0] // get the oldest one

    this._log(`searching for plays newer than ${updated}`)

    const plays = await db('nflPlay')
      .where({ week: constants.season.week })
      .where('updated', '>', updated)

    this._log(`${plays.length} updated plays found`)

    const playIds = plays.map(p => p.playId)
    const playStats = await db('nflPlayStat').whereIn('playId', playIds)
    const playSnaps = await db('nflSnap').whereIn('playId', playIds)

    for (const play of plays) {
      play.playStats = playStats.filter(p => p.playId === play.playId)
      play.playSnaps = playSnaps.filter(p => p.playId === play.playId)
    }

    // loop through users and broadcast diff
    for (const [userId, updated] of this._users.entries()) {
      const userPlays = plays.filter(p => p.updated > updated)

      if (!userPlays.length) continue

      this._log(`sending ${userPlays.length} plays to userId(${userId})`)
      const event = {
        type: 'UPDATE_SCOREBOARD_PLAYS',
        payload: {
          data: userPlays
        }
      }

      this._wss.clients.forEach((c) => {
        if (c.userId === userId) {
          if (c && c.readyState === WebSocket.OPEN) {
            c.send(JSON.stringify(event))
          }
        }
      })
    }

    await wait(5000)

    if (this._users.size) this.poll()
    else this._isPolling = false
  }
}
