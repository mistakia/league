const moment = require('moment')

const db = require('../db')
const { constants } = require('../common')

module.exports = async (leagueId) => {
  // get relevant transactions from last 24 hours
  const cutoff = moment().subtract('24', 'hours').format('X')
  const transactions = await db('transactions')
    .where('type', constants.transactions.ROSTER_DROP)
    .where('timestamp', '>=', cutoff)
    .where('lid', leagueId)

  const playerIds = transactions.map(t => t.player)
  const query = db('waivers')
    .select('teams.*', 'waivers.uid as wid', 'waivers.bid', 'waivers.player', 'waivers.drop', 'waivers.tid', 'waivers.userid')
    .join('teams', 'waivers.tid', 'teams.uid')
    .whereNull('processed')
    .whereNull('cancelled')
    .where('type', constants.waivers.FREE_AGENCY)
    .orderBy([{
      column: 'waivers.bid',
      order: 'desc'
    }, {
      column: 'teams.wo',
      order: 'asc'
    }, {
      column: 'waivers.po',
      order: 'asc'
    }, {
      column: 'waivers.uid',
      order: 'asc'
    }])

  if (playerIds.length) {
    query.whereNotIn('waivers.player', playerIds)
  }

  const waivers = await query

  return waivers.length ? waivers[0] : undefined
}
