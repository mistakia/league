import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone.js'

import db from '#db'
import { constants } from '#common'

dayjs.extend(timezone)

export default async function (leagueId) {
  // get relevant transactions from last 24 hours
  const cutoff = dayjs().subtract('24', 'hours').unix()

  const recent_transaction_rows = await db('transactions')
    .where('type', constants.transactions.ROSTER_RELEASE)
    .where('timestamp', '>=', cutoff)
    .where('lid', leagueId)

  const recent_transaction_pids = recent_transaction_rows.map((t) => t.pid)
  const query = db('waivers')
    .select(
      'teams.*',
      'waivers.uid as wid',
      'waivers.bid',
      'waivers.pid',
      'waivers.tid',
      'waivers.userid',
      'nfl_games.date',
      'nfl_games.time_est'
    )
    .join('teams', 'waivers.tid', 'teams.uid')
    .join('player', 'waivers.pid', 'player.pid')
    .joinRaw(
      `left join nfl_games on (player.cteam = nfl_games.v or player.cteam = nfl_games.h) and (nfl_games.week = ${constants.season.week} or nfl_games.week is null) and (nfl_games.year = ${constants.season.year} or nfl_games.year is null) and (nfl_games.seas_type = 'REG' or nfl_games.seas_type is null)`
    )
    .where('teams.year', constants.season.year)
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

  if (recent_transaction_pids.length) {
    query.whereNotIn('waivers.pid', recent_transaction_pids)
  }

  const waiver_rows = await query

  const now = dayjs()
  const filtered = waiver_rows.filter((waiver_row_player) => {
    if (!waiver_row_player.date) return true
    const gameStart = dayjs.tz(
      `${waiver_row_player.date} ${waiver_row_player.time_est}`,
      'YYYY/MM/DD HH:mm:SS',
      'America/New_York'
    )
    return now.isBefore(gameStart)
  })

  return filtered.length ? filtered[0] : undefined
}
