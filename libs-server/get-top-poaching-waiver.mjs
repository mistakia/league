import dayjs from 'dayjs'

import db from '#db'
import { current_season, waiver_types, transaction_types } from '#constants'

export default async function (league_id) {
  // sanctuary period and waiver period both last 24 hours and overlap
  // exclude players still in these periods from waiver processing (but allow waiver submission)
  const sanctuary_period = dayjs().subtract('24', 'hours').unix()
  const transactions = await db('transactions')
    .whereIn('type', [
      transaction_types.DRAFT,
      transaction_types.PRACTICE_ADD,
      transaction_types.ROSTER_DEACTIVATE
    ])
    .where('timestamp', '>=', sanctuary_period)
    .where('lid', league_id)

  const exclude_pids = transactions.map((t) => t.pid)
  const waivers_query = db('waivers')
    .select(
      'teams.*',
      'waivers.uid as wid',
      'waivers.pid',
      'waivers.tid',
      'waivers.userid',
      'waivers.type as waiver_type'
    )
    .join('teams', 'waivers.tid', 'teams.uid')
    .where('teams.year', current_season.year)
    .whereNull('processed')
    .whereNull('cancelled')
    .where('type', waiver_types.POACH)
    .orderBy(['teams.waiver_order', 'waivers.po', 'waivers.uid'])

  if (exclude_pids.length) {
    waivers_query.whereNotIn('waivers.pid', exclude_pids)
  }

  const waivers = await waivers_query

  return waivers.length ? waivers[0] : undefined
}
