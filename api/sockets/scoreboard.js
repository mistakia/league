const WebSocket = require('ws')
const debug = require('debug')

const db = require('../../db')
const { constants, uniqBy } = require('../../common')
const { getPlayByPlayQuery } = require('../../utils')

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
    if (!this._users.has(userId)) ws.on('close', () => this._users.delete(userId))
    this._users.set(userId, updated)
    if (!this._isPolling) this.poll()
  }

  async poll () {
    // TODO - only poll while games are pending
    this._log('polling for scoreboard updates')
    this._isPolling = true
    const updateTimestamps = Array.from(this._users.values()).sort((a, b) => a - b)
    const updated = updateTimestamps[0] // get the oldest one

    this._log(`searching for plays newer than ${updated}`)

    const query = getPlayByPlayQuery(db)
    const plays = await query
      .where('nflPlay.week', constants.season.week)
      .where('updated', '>', updated)

    this._log(`${plays.length} updated plays found`)

    const esbids = Array.from(uniqBy(plays, 'esbid')).map(p => p.esbid)
    const playStats = await db('nflPlayStat').whereIn('esbid', esbids).where('valid', 1)
    const playSnaps = await db('nflSnap').whereIn('esbid', esbids)

    for (const play of plays) {
      play.playStats = playStats.filter(p => p.playId === play.playId && p.esbid === play.esbid)
      play.playSnaps = playSnaps.filter(p => p.playId === play.playId && p.esbid === play.esbid)
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
