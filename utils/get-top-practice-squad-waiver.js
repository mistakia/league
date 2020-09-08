const moment = require('moment-timezone')

const db = require('../db')
const { constants } = require('../common')
const getLeague = require('./get-league')

module.exports = async (leagueId) => {
  const league = await getLeague(leagueId)
  const days = (league.nteams * 3) + 1 // total picks + waiver day
  if (!league.ddate || moment().isBefore(moment(league.ddate, 'X').add(days, 'day'))) {
    return undefined
  }

  if (constants.season.isRegularSeason && constants.season.isWaiverPeriod) {
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

  if (constants.season.isRegularSeason) {
    query
      .select('schedule.date')
      .join('player', 'waivers.player', 'player.player')
      .joinRaw('left join schedule on player.cteam = schedule.v or player.cteam = schedule.h')
      .where('schedule.wk', constants.season.week)
      .where('schedule.seas', constants.season.year)
  }

  if (playerIds.length) {
    query.whereNotIn('waivers.player', playerIds)
  }

  const waivers = await query

  if (constants.season.isRegularSeason) {
    const now = moment()
    const filtered = waivers.filter(player => {
      const gameStart = moment.tz(player.date, 'M/D/YYYY H:m', 'America/New_York')
      return now.isBefore(gameStart)
    })

    return filtered.length ? filtered[0] : undefined
  }

  return waivers.length ? waivers[0] : undefined
}
