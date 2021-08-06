const dayjs = require('dayjs')
const timezone = require('dayjs/plugin/timezone')

const db = require('../db')
const { constants } = require('../common')

dayjs.extend(timezone)

module.exports = async (leagueId) => {
  // get relevant transactions from last 24 hours
  const cutoff = dayjs().subtract('24', 'hours').unix()

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
      'waivers.tid',
      'waivers.userid',
      'schedule.date'
    )
    .join('teams', 'waivers.tid', 'teams.uid')
    .join('player', 'waivers.player', 'player.player')
    .joinRaw(
      `left join schedule on (player.cteam = schedule.v or player.cteam = schedule.h) and (schedule.wk = ${constants.season.week} or schedule.wk is null) and (schedule.seas = ${constants.season.year} or schedule.seas is null)`
    )
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

  const now = dayjs()
  const filtered = waivers.filter((player) => {
    if (!player.date) return true
    const gameStart = dayjs.tz(player.date, 'M/D/YYYY H:m', 'America/New_York')
    return now.isBefore(gameStart)
  })

  return filtered.length ? filtered[0] : undefined
}
