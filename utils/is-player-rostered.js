const db = require('../db')
const { constants } = require('../common')

module.exports = async ({ player, leagueId }) => {
  const rosterRows = await db('rosters_players')
    .join('rosters', 'rosters_players.rid', 'rosters.uid')
    .where({
      player,
      lid: leagueId,
      week: constants.season.week,
      year: constants.season.year
    })

  return Boolean(rosterRows.length)
}
