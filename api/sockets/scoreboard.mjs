import WebSocket from 'ws'
import debug from 'debug'

import db from '#db'
import { constants, uniqBy } from '#common'
import { getPlayByPlayQuery } from '#utils'

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

export default class Scoreboard {
  constructor(wss) {
    this._wss = wss
    this._isPolling = false
    this._users = new Map()
    this._log = debug('scoreboard')
  }

  register({ ws, userId, updated }) {
    this._log(`registering userId(${userId}) for scoreboard updates`)
    ws.on('close', () => {
      this._log(`removing userId(${userId}) from scoreboard`)
      this._users.delete(userId)
    })
    this._users.set(userId, updated)

    const event = {
      type: 'SCOREBOARD_REGISTER'
    }

    ws.send(JSON.stringify(event))
    if (!this._isPolling) this.poll()
  }

  async poll() {
    // TODO - only poll while games are pending
    this._log('polling for scoreboard updates')
    this._isPolling = true
    const updateTimestamps = Array.from(this._users.values()).sort(
      (a, b) => a - b
    )
    const updated = updateTimestamps[0] // get the oldest one

    this._log(`searching for plays newer than ${updated}`)

    const query = getPlayByPlayQuery(db)
    const plays = await query
      .where('nfl_plays_current_week.seas', constants.season.year)
      .where('nfl_plays_current_week.wk', constants.season.week)
      .where('nfl_plays_current_week.seas_type', 'REG')
      .where('updated', '>', updated)

    this._log(`${plays.length} updated plays found`)

    const esbids = Array.from(uniqBy(plays, 'esbid')).map((p) => p.esbid)
    const playStats = await db('nfl_play_stats_current_week')
      .whereIn('esbid', esbids)
      .where('valid', 1)
    const playSnaps = await db('nfl_snaps_current_week').whereIn(
      'esbid',
      esbids
    )

    for (const play of plays) {
      play.playStats = playStats.filter(
        (p) => p.playId === play.playId && p.esbid === play.esbid
      )
      play.playSnaps = playSnaps.filter(
        (p) => p.playId === play.playId && p.esbid === play.esbid
      )
    }

    // loop through users and broadcast diff
    for (const [userId, updated] of this._users.entries()) {
      const userPlays = plays.filter((p) => p.updated > updated)

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
