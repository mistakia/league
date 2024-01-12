import dayjs from 'dayjs'

import db from '#db'
import { constants } from '#libs-shared'

export default async function (leagueId) {
  // get relevant transactions from last 48 hours
  const cutoff = dayjs().subtract('48', 'hours').unix()
  const transactions = await db('transactions')
    .whereIn('type', [
      constants.transactions.DRAFT,
      constants.transactions.PRACTICE_ADD,
      constants.transactions.ROSTER_DEACTIVATE
    ])
    .where('timestamp', '>=', cutoff)
    .where('lid', leagueId)

  const exclude_pids = transactions.map((t) => t.pid)
  const waiversQuery = db('waivers')
    .select(
      'teams.*',
      'waivers.uid as wid',
      'waivers.pid',
      'waivers.tid',
      'waivers.userid'
    )
    .join('teams', 'waivers.tid', 'teams.uid')
    .where('teams.year', constants.season.year)
    .whereNull('processed')
    .whereNull('cancelled')
    .where('type', constants.waivers.POACH)
    .orderBy(['teams.waiver_order', 'waivers.po', 'waivers.uid'])

  if (exclude_pids.length) {
    waiversQuery.whereNotIn('waivers.pid', exclude_pids)
  }

  const waivers = await waiversQuery

  return waivers.length ? waivers[0] : undefined
}
