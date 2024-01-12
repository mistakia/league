import dayjs from 'dayjs'

import db from '#db'
import { constants, getDraftDates } from '#libs-shared'
import getLeague from './get-league.mjs'

export default async function (lid) {
  const league = await getLeague({ lid })
  const picks = await db('draft')
    .where({
      year: constants.season.year,
      lid
    })
    .orderBy('pick', 'asc')

  const lastPick = picks[picks.length - 1]
  const draftDates = getDraftDates({
    start: league.draft_start,
    picks: picks.length,
    type: league.draft_type,
    min: league.draft_hour_min,
    max: league.draft_hour_max,
    last_selection_timestamp: lastPick ? lastPick.selection_timestamp : null
  })

  if (!league.draft_start || dayjs().isBefore(draftDates.waiverEnd)) {
    return undefined
  }

  if (constants.season.isRegularSeason && constants.season.isWaiverPeriod) {
    return undefined
  }

  const active_waiver_rows = await db('waivers')
    .whereNull('processed')
    .whereNull('cancelled')
    .where('lid', lid)
    .where('type', constants.waivers.FREE_AGENCY)
    .groupBy('pid')
  const active_waiver_pids = active_waiver_rows.map((w) => w.pid)

  // TODO - return undefined if there are any active waivers and practice waiver players

  // get relevant transactions from last 24 hours
  const cutoff = dayjs().subtract('24', 'hours').unix()
  const recent_transaction_rows = await db('transactions')
    .where('type', constants.transactions.ROSTER_RELEASE)
    .where('timestamp', '>=', cutoff)
    .where('lid', lid)
  const recent_transaction_pids = recent_transaction_rows.map((t) => t.pid)

  const query = db('waivers')
    .select(
      'teams.*',
      'waivers.uid as wid',
      'waivers.bid',
      'waivers.pid',
      'waivers.tid',
      'waivers.userid'
    )
    .join('teams', 'waivers.tid', 'teams.uid')
    .where('teams.year', constants.season.year)
    .whereNull('processed')
    .whereNull('cancelled')
    .where('waivers.lid', lid)
    .where('waivers.type', constants.waivers.FREE_AGENCY_PRACTICE)
    .orderBy([
      {
        column: 'teams.waiver_order',
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

  if (constants.season.isRegularSeason) {
    query
      .select('nfl_games.date')
      .select('nfl_games.time_est')
      .join('player', 'waivers.pid', 'player.pid')
      .joinRaw(
        `left join nfl_games on nfl_games.week = ${constants.season.week} and nfl_games.year = ${constants.season.year} and nfl_games.seas_type = "REG" and (player.cteam = nfl_games.v or player.cteam = nfl_games.h)`
      )
  }

  if (recent_transaction_pids.length) {
    query.whereNotIn('waivers.pid', recent_transaction_pids)
  }

  if (active_waiver_pids.length) {
    query.whereNotIn('waivers.pid', active_waiver_pids)
  }

  const waiver_rows = await query

  if (constants.season.isRegularSeason) {
    const now = dayjs()
    const filtered = waiver_rows.filter((waiver_row) => {
      if (!waiver_row.date) return true
      const gameStart = dayjs.tz(
        `${waiver_row.date} ${waiver_row.time_est}`,
        'YYYY/MM/DD HH:mm:SS',
        'America/New_York'
      )
      return now.isBefore(gameStart)
    })

    return filtered.length ? filtered[0] : undefined
  }

  return waiver_rows.length ? waiver_rows[0] : undefined
}
