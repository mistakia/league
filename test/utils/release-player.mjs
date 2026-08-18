import db from '#db'
import { current_season, transaction_types } from '#constants'

export default async function ({ leagueId, player, teamId, userId }) {
  const rids = await db('rosters')
    .where({
      tid: teamId,
      week: current_season.week,
      season_year: current_season.year
    })
    .limit(1)

  const rid = rids[0].roster_id

  await db('rosters_players')
    .where({
      pid: player.pid,
      roster_id: rid
    })
    .del()

  await db('transactions').insert({
    user_id: userId,
    tid: teamId,
    lid: leagueId,
    pid: player.pid,
    type: transaction_types.ROSTER_RELEASE,
    player_salary: 0,
    week: current_season.week,
    season_year: current_season.year,
    occurred_at: new Date()
  })
}
