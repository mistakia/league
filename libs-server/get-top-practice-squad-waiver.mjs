import dayjs from 'dayjs'

import db from '#db'
import { getDraftDates } from '#libs-shared'
import { current_season, waiver_types, transaction_types } from '#constants'
import getLeague from './get-league.mjs'
import apply_nfl_games_current_week_join from './data-views/join-nfl-games-current-week.mjs'

export default async function (lid) {
  const league = await getLeague({ lid })
  // Get the season data: the announced hard end, and the explicit completion
  // timestamp that overrides it once the draft actually finishes.
  const season = await db('seasons')
    .where({
      lid,
      season_year: current_season.year
    })
    .first()

  const draft_dates = getDraftDates({
    rookie_draft_end_at: season ? season.rookie_draft_end_at : null,
    rookie_draft_completed_at: season ? season.rookie_draft_completed_at : null
  })

  if (!league.draft_start || dayjs().isBefore(draft_dates.waiverEnd)) {
    return undefined
  }

  if (current_season.isRegularSeason && current_season.isWaiverPeriod) {
    return undefined
  }

  const active_waiver_rows = await db('waivers')
    .select('pid')
    .whereNull('processed')
    .whereNull('cancelled')
    .where('lid', lid)
    .where('type', waiver_types.FREE_AGENCY)
    .groupBy('pid')
  const active_waiver_pids = active_waiver_rows.map((w) => w.pid)

  // get relevant transactions from last 24 hours
  // transactions.occurred_at is timestamptz, so the bound is a Date.
  const cutoff = dayjs().subtract('24', 'hours').toDate()
  const recent_transaction_rows = await db('transactions')
    .where('type', transaction_types.ROSTER_RELEASE)
    .where('occurred_at', '>=', cutoff)
    .where('lid', lid)
  const recent_transaction_pids = recent_transaction_rows.map((t) => t.pid)

  const query = db('waivers')
    .select(
      'teams.*',
      'waivers.uid as wid',
      'waivers.bid_amount',
      'waivers.pid',
      'waivers.tid',
      'waivers.user_id',
      'waivers.type as waiver_type'
    )
    .join('teams', 'waivers.tid', 'teams.uid')
    .where('teams.season_year', current_season.year)
    .whereNull('processed')
    .whereNull('cancelled')
    .where('waivers.lid', lid)
    .where('waivers.type', waiver_types.FREE_AGENCY_PRACTICE)
    .orderBy([
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

  if (!current_season.isOffseason) {
    query
      .select('nfl_games.date')
      .select('nfl_games.time_eastern')
      .join('player', 'waivers.pid', 'player.pid')
    apply_nfl_games_current_week_join({ db, query })
  }

  if (recent_transaction_pids.length) {
    query.whereNotIn('waivers.pid', recent_transaction_pids)
  }

  if (active_waiver_pids.length) {
    query.whereNotIn('waivers.pid', active_waiver_pids)
  }

  // Check for super priority claims first
  const super_priority_query = db('waivers')
    .select(
      'teams.*',
      'waivers.uid as wid',
      'waivers.bid_amount',
      'waivers.pid',
      'waivers.tid',
      'waivers.user_id',
      'waivers.type as waiver_type',
      'waivers.super_priority'
    )
    .join('teams', 'waivers.tid', 'teams.uid')
    .where('teams.season_year', current_season.year)
    .whereNull('processed')
    .whereNull('cancelled')
    .where('waivers.lid', lid)
    .where('waivers.type', waiver_types.FREE_AGENCY_PRACTICE)
    .where('waivers.super_priority', 1)
    .orderBy([
      {
        column: 'waivers.submitted',
        order: 'asc'
      },
      {
        column: 'waivers.uid',
        order: 'asc'
      }
    ])

  if (recent_transaction_pids.length) {
    super_priority_query.whereNotIn('waivers.pid', recent_transaction_pids)
  }

  if (active_waiver_pids.length) {
    super_priority_query.whereNotIn('waivers.pid', active_waiver_pids)
  }

  const super_priority_waivers = await super_priority_query

  // If there are super priority claims, return the first one
  if (super_priority_waivers.length) {
    return super_priority_waivers[0]
  }

  const waiver_rows = await query

  if (!current_season.isOffseason) {
    const now = dayjs()
    const filtered = waiver_rows.filter((waiver_row) => {
      if (!waiver_row.date) return true
      const gameStart = dayjs.tz(
        `${waiver_row.date} ${waiver_row.time_eastern}`,
        'YYYY/MM/DD HH:mm:SS',
        'America/New_York'
      )
      return now.isBefore(gameStart)
    })

    return filtered.length ? filtered[0] : undefined
  }

  return waiver_rows.length ? waiver_rows[0] : undefined
}
