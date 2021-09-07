const dayjs = require('dayjs')

const db = require('../db')
const { constants } = require('../common')

module.exports = async (leagueId) => {
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

  const excludePlayerIds = transactions.map((t) => t.player)
  const waiversQuery = db('waivers')
    .select(
      'teams.*',
      'waivers.uid as wid',
      'waivers.player',
      'waivers.tid',
      'waivers.userid'
    )
    .join('teams', 'waivers.tid', 'teams.uid')
    .whereNull('processed')
    .whereNull('cancelled')
    .where('type', constants.waivers.POACH)
    .orderBy(['teams.wo', 'waivers.po', 'waivers.uid'])

  if (excludePlayerIds.length) {
    waiversQuery.whereNotIn('waivers.player', excludePlayerIds)
  }

  const waivers = await waiversQuery

  return waivers.length ? waivers[0] : undefined
}
