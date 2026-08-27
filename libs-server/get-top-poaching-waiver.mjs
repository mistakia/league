import dayjs from 'dayjs'

import db from '#db'
import { current_season, waiver_types, transaction_types } from '#constants'

export default async function (league_id) {
  // sanctuary period and waiver period both last 24 hours and overlap
  // exclude players still in these periods from waiver processing (but allow waiver submission)
  // transactions.occurred_at is timestamptz, so the bound is a Date.
  const sanctuary_period = dayjs().subtract('24', 'hours').toDate()
  const transactions = await db('transactions')
    .whereIn('type', [
      transaction_types.DRAFT,
      transaction_types.PRACTICE_ADD,
      transaction_types.ROSTER_DEACTIVATE
    ])
    .where('occurred_at', '>=', sanctuary_period)
    .where('lid', league_id)

  const exclude_pids = transactions.map((t) => t.pid)
  const waivers_query = db('waivers')
    .select(
      'teams.*',
      'waivers.waiver_id as wid',
      'waivers.lid',
      'waivers.pid',
      'waivers.tid',
      'waivers.user_id',
      'waivers.type as waiver_type'
    )
    .join('teams', 'waivers.tid', 'teams.team_id')
    .where('teams.season_year', current_season.year)
    .where('waivers.lid', league_id)
    .whereNull('waivers.processed')
    .whereNull('waivers.cancelled')
    .where('waivers.type', waiver_types.POACH)
    .orderBy([
      'teams.waiver_order',
      'waivers.priority_order',
      'waivers.waiver_id'
    ])

  if (exclude_pids.length) {
    waivers_query.whereNotIn('waivers.pid', exclude_pids)
  }

  const waivers = await waivers_query

  return waivers.length ? waivers[0] : undefined
}
