const db = require('../../db')
const { constants } = require('../../common')

module.exports = async ({ leagueId, player, teamId, userId }) => {
  const rids = await db('rosters').where({
    tid: teamId,
    week: constants.season.week,
    year: constants.season.year
  }).limit(1)

  const rid = rids[0].uid

  await db('rosters_players')
    .where({
      player: player.player,
      rid
    })
    .del()

  await db('transactions').insert({
    userid: userId,
    tid: teamId,
    lid: leagueId,
    player: player.player,
    type: constants.transactions.ROSTER_DROP,
    value: 0,
    year: constants.season.year,
    timestamp: Math.round(Date.now() / 1000)
  })
}
