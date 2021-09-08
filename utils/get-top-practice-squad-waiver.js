const dayjs = require('dayjs')

const db = require('../db')
const { constants, getDraftDates } = require('../common')
const getLeague = require('./get-league')

module.exports = async (leagueId) => {
  const league = await getLeague(leagueId)
  const picks = await db('draft').where({
    year: constants.season.year,
    lid: leagueId
  })
  const draftDates = getDraftDates({
    start: league.ddate,
    picks: picks.length
  })
  if (!league.ddate || dayjs().isBefore(draftDates.waiverEnd)) {
    return undefined
  }

  if (constants.season.isRegularSeason && constants.season.isWaiverPeriod) {
    return undefined
  }

  const activeWaivers = await db('waivers')
    .whereNull('processed')
    .whereNull('cancelled')
    .where('lid', leagueId)
    .where('type', constants.waivers.FREE_AGENCY)
    .groupBy('player')
  const activeWaiverPlayerIds = activeWaivers.map((w) => w.player)

  // TODO - return undefined if there are any active waivers and practice waiver players

  // get relevant transactions from last 24 hours
  const cutoff = dayjs().subtract('24', 'hours').unix()
  const transactions = await db('transactions')
    .where('type', constants.transactions.ROSTER_RELEASE)
    .where('timestamp', '>=', cutoff)
    .where('lid', leagueId)
  const playerIds = transactions.map((t) => t.player)

  const query = db('waivers')
    .select(
      'teams.*',
      'waivers.uid as wid',
      'waivers.bid',
      'waivers.player',
      'waivers.tid',
      'waivers.userid'
    )
    .join('teams', 'waivers.tid', 'teams.uid')
    .whereNull('processed')
    .whereNull('cancelled')
    .where('waivers.lid', leagueId)
    .where('waivers.type', constants.waivers.FREE_AGENCY_PRACTICE)
    .orderBy([
      {
        column: 'teams.wo',
        order: 'asc'
      },
      {
        column: 'waivers.po',
        order: 'asc'
      },
      {
        column: 'waivers.uid',
        order: 'asc'
      }
    ])

  if (constants.season.isRegularSeason) {
    query
      .select('nfl_games.date')
      .select('nfl_games.time_est')
      .join('player', 'waivers.player', 'player.player')
      .joinRaw(
        'left join nfl_games on player.cteam = nfl_games.v or player.cteam = nfl_games.h'
      )
      .where('nfl_games.wk', constants.season.week)
      .where('nfl_games.seas', constants.season.year)
      .where('nfl_games.type', 'REG')
  }

  if (playerIds.length) {
    query.whereNotIn('waivers.player', playerIds)
  }

  if (activeWaiverPlayerIds.length) {
    query.whereNotIn('waivers.player', activeWaiverPlayerIds)
  }

  const waivers = await query

  if (constants.season.isRegularSeason) {
    const now = dayjs()
    const filtered = waivers.filter((player) => {
      const gameStart = dayjs.tz(
        `${player.date} ${player.time_est}`,
        'YYYY/MM/DD HH:mm:SS',
        'America/New_York'
      )
      return now.isBefore(gameStart)
    })

    return filtered.length ? filtered[0] : undefined
  }

  return waivers.length ? waivers[0] : undefined
}
