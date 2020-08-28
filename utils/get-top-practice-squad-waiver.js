const moment = require('moment')

const db = require('../db')
const { constants } = require('../common')
const getLeague = require('./get-league')

module.exports = async (leagueId) => {
  const league = await getLeague(leagueId)
  const days = (league.nteams * 3) + 1 // total picks + waiver day
  if (!league.ddate || moment().isBefore(moment(league.ddate, 'X').add(days, 'day'))) {
    return undefined
  }

  // get relevant transactions from last 24 hours
  const cutoff = moment().subtract('24', 'hours').format('X')
  const transactions = await db('transactions')
    .where('type', constants.transactions.ROSTER_RELEASE)
    .where('timestamp', '>=', cutoff)
    .where('lid', leagueId)
  const playerIds = transactions.map(t => t.player)

  const query = db('waivers')
    .select('teams.*', 'waivers.uid as wid', 'waivers.bid', 'waivers.player', 'waivers.drop', 'waivers.tid', 'waivers.userid')
    .join('teams', 'waivers.tid', 'teams.uid')
    .whereNull('processed')
    .whereNull('cancelled')
    .where('type', constants.waivers.FREE_AGENCY_PRACTICE)
    .orderBy([{
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
