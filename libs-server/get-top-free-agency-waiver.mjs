import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone.js'

import db from '#db'
import { current_season, waiver_types, transaction_types } from '#constants'
import apply_nfl_games_current_week_join from './data-views/join-nfl-games-current-week.mjs'

dayjs.extend(timezone)

export default async function (leagueId) {
  // get relevant transactions from last 24 hours
  // transactions.occurred_at is timestamptz, so the bound is a Date.
  const cutoff = dayjs().subtract('24', 'hours').toDate()

  const recent_transaction_rows = await db('transactions')
    .where('type', transaction_types.ROSTER_RELEASE)
    .where('occurred_at', '>=', cutoff)
    .where('lid', leagueId)

  const recent_transaction_pids = recent_transaction_rows.map((t) => t.pid)

  const query = db('waivers')
    .select(
      'teams.*',
      'waivers.uid as wid',
      'waivers.bid_amount',
      'waivers.pid',
      'waivers.tid',
      'waivers.userid',
      'waivers.type as waiver_type',
      'nfl_games.date',
      'nfl_games.time_est'
    )
    .join('teams', 'waivers.tid', 'teams.uid')
    .join('player', 'waivers.pid', 'player.pid')
    .where('teams.season_year', current_season.year)
    .where('waivers.lid', leagueId)
    .whereNull('processed')
    .whereNull('cancelled')
    .where('waivers.type', waiver_types.FREE_AGENCY)
    .orderBy([
      {
        column: 'waivers.bid_amount',
        order: 'desc'
      },
      {
        column: 'teams.waiver_order',
        order: 'asc'
      },
      {
        column: 'waivers.priority_order',
        order: 'asc'
      },
      {
        column: 'waivers.uid',
        order: 'asc'
      }
    ])

  apply_nfl_games_current_week_join({ db, query })

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
