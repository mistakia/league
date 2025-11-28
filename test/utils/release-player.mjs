import db from '#db'
import { current_season, transaction_types } from '#constants'

export default async function ({ leagueId, player, teamId, userId }) {
  const rids = await db('rosters')
    .where({
      tid: teamId,
      week: current_season.week,
      year: current_season.year
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
    type: transaction_types.ROSTER_RELEASE,
    value: 0,
    week: current_season.week,
    year: current_season.year,
    timestamp: Math.round(Date.now() / 1000)
  })
}
