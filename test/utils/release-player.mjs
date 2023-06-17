import db from '#db'
import { constants } from '#libs-shared'

export default async function ({ leagueId, player, teamId, userId }) {
  const rids = await db('rosters')
    .where({
      tid: teamId,
      week: constants.season.week,
      year: constants.season.year
    })
    .limit(1)

  const rid = rids[0].uid

  await db('rosters_players')
    .where({
      pid: player.pid,
      rid
    })
    .del()

  await db('transactions').insert({
    userid: userId,
    tid: teamId,
    lid: leagueId,
    pid: player.pid,
    type: constants.transactions.ROSTER_RELEASE,
    value: 0,
    week: constants.season.week,
    year: constants.season.year,
    timestamp: Math.round(Date.now() / 1000)
  })
}
