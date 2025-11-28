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
  waiverid
}) {
  const rosters = await db('rosters')
    .where({
      week: current_season.week,
      year: current_season.year,
      tid: teamId
    })
    .limit(1)
  const rosterId = rosters[0].uid

  await db('transactions').insert({
    userid: userId,
    tid: teamId,
    lid: leagueId,
    pid: player.pid,
    type: transaction,
    value,
    week: current_season.week,
    year: current_season.year,
    timestamp: Math.round(Date.now() / 1000),
    waiverid
  })

  await db('rosters_players').insert({
    rid: rosterId,
    pid: player.pid,
    slot,
    pos: player.pos1,
    tag,
    tid: teamId,
    lid: leagueId,
    year: current_season.year,
    week: current_season.week
  })
}
