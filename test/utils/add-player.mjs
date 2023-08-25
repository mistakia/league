import db from '#db'
import { constants } from '#libs-shared'

export default async function ({
  leagueId,
  player,
  teamId,
  userId,
  slot = constants.slots.BENCH,
  transaction = constants.transactions.ROSTER_ADD,
  value = 0,
  tag = constants.tags.REGULAR,
  waiverid
}) {
  const rosters = await db('rosters')
    .where({
      week: constants.season.week,
      year: constants.season.year,
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
    week: constants.season.week,
    year: constants.season.year,
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
    year: constants.season.year,
    week: constants.season.week
  })
}
