const db = require('../db')
const { constants } = require('../common')

module.exports = async (leagueId) => {
  const leagues = await db('leagues')
    .leftJoin('seasons', 'leagues.uid', 'seasons.lid')
    .where(function () {
      this.where('year', constants.season.year)
      this.orWhereNull('year')
    })
    .where({ uid: leagueId })
  return leagues[0]
}
