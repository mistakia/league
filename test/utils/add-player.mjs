import db from '#db'
import {
  current_season,
  roster_slot_types,
  transaction_types,
  player_tag_types
} from '#constants'

export default async function ({
  leagueId,
  player,
  teamId,
  userId,
  slot = roster_slot_types.BENCH,
  transaction = transaction_types.ROSTER_ADD,
  value = 0,
  tag = player_tag_types.REGULAR,
  waiver_id
}) {
  let rosters = await db('rosters')
    .where({
      week: current_season.week,
      season_year: current_season.year,
      tid: teamId
    })
    .limit(1)
  if (!rosters[0]) {
    await db('rosters').insert({
      tid: teamId,
      lid: leagueId,
      week: current_season.week,
      season_year: current_season.year,
      last_updated: new Date()
    })
    rosters = await db('rosters')
      .where({
        week: current_season.week,
        season_year: current_season.year,
        tid: teamId
      })
      .limit(1)
  }
  const rosterId = rosters[0].roster_id

  await db('transactions').insert({
    user_id: userId,
    tid: teamId,
    lid: leagueId,
    pid: player.pid,
    type: transaction,
    player_salary: value,
    week: current_season.week,
    season_year: current_season.year,
    occurred_at: new Date(),
    waiver_id
  })

  await db('rosters_players').insert({
    roster_id: rosterId,
    pid: player.pid,
    slot,
    player_position: player.secondary_position,
    tag,
    tid: teamId,
    lid: leagueId,
    season_year: current_season.year,
    week: current_season.week
  })
}
