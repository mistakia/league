const moment = require('moment')

const db = require('../db')
const { constants } = require('../common')

module.exports = async (leagueId) => {
  // get relevant transactions from last 24 hours
  const cutoff = moment().subtract('24', 'hours').format('X')
  const transactions = await db('transactions')
    .whereIn('type', [
      constants.transactions.DRAFT,
      constants.transactions.PRACTICE_ADD,
      constants.transactions.ROSTER_DEACTIVATE
    ])
    .where('timestamp', '>=', cutoff)
    .where('lid', leagueId)

  const excludePlayerIds = transactions.map(t => t.player)
  const waiversQuery = db('waivers')
    .select('teams.*', 'waivers.uid as wid', 'waivers.player', 'waivers.drop', 'waivers.tid', 'waivers.userid')
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
