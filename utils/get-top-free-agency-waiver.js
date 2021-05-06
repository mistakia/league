const moment = require('moment-timezone')

const db = require('../db')
const { constants } = require('../common')

module.exports = async (leagueId) => {
  // get relevant transactions from last 24 hours
  const cutoff = moment().subtract('24', 'hours').format('X')
  const transactions = await db('transactions')
    .where('type', constants.transactions.ROSTER_RELEASE)
    .where('timestamp', '>=', cutoff)
    .where('lid', leagueId)

  const playerIds = transactions.map((t) => t.player)
  const query = db('waivers')
    .select(
      'teams.*',
      'waivers.uid as wid',
      'waivers.bid',
      'waivers.player',
      'waivers.drop',
      'waivers.tid',
      'waivers.userid',
      'schedule.date'
    )
    .join('teams', 'waivers.tid', 'teams.uid')
    .join('player', 'waivers.player', 'player.player')
    .joinRaw(
      'left join schedule on player.cteam = schedule.v or player.cteam = schedule.h'
    )
    .where(function () {
      this.where('schedule.wk', constants.season.week).orWhere(
        'schedule.wk',
        null
      )
    })
    .where(function () {
      this.where('schedule.seas', constants.season.year).orWhere(
        'schedule.seas',
        null
      )
    })
    .where('waivers.lid', leagueId)
    .whereNull('processed')
    .whereNull('cancelled')
    .where('type', constants.waivers.FREE_AGENCY)
    .orderBy([
      {
        column: 'waivers.bid',
        order: 'desc'
      },
      {
        column: 'teams.wo',
        order: 'asc'
      },
      {
        column: 'waivers.po',
        order: 'asc'
      },
      {
        column: 'waivers.uid',
        order: 'asc'
      }
    ])

  if (playerIds.length) {
    query.whereNotIn('waivers.player', playerIds)
  }

  const waivers = await query

  const now = moment()
  const filtered = waivers.filter((player) => {
    if (!player.date) return true
    const gameStart = moment.tz(player.date, 'M/D/YYYY H:m', 'America/New_York')
    return now.isBefore(gameStart)
  })

  return filtered.length ? filtered[0] : undefined
}
