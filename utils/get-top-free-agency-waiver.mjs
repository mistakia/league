import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone.js'

import db from '#db'
import { constants } from '#common'

dayjs.extend(timezone)

export default async function (leagueId) {
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
      'nfl_games.date',
      'nfl_games.time_est'
    )
    .join('teams', 'waivers.tid', 'teams.uid')
    .join('player', 'waivers.player', 'player.player')
    .joinRaw(
      `left join nfl_games on (player.cteam = nfl_games.v or player.cteam = nfl_games.h) and (nfl_games.wk = ${constants.season.week} or nfl_games.wk is null) and (nfl_games.seas = ${constants.season.year} or nfl_games.seas is null) and (nfl_games.type = 'REG' or nfl_games.type is null)`
    )
    .where('waivers.lid', leagueId)
    .whereNull('processed')
    .whereNull('cancelled')
    .where('waivers.type', constants.waivers.FREE_AGENCY)
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
    const gameStart = dayjs.tz(
      `${player.date} ${player.time_est}`,
      'YYYY/MM/DD HH:mm:SS',
      'America/New_York'
    )
    return now.isBefore(gameStart)
  })

  return filtered.length ? filtered[0] : undefined
}
