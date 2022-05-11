import db from '#db'
import { constants } from '#common'

export default async function ({
  leagueId,
  player,
  teamId,
  userId,
  slot = constants.slots.BENCH,
  transaction = constants.transactions.ROSTER_ADD,
  value = 0
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
    player: player.player,
    type: transaction,
    value,
    year: constants.season.year,
    timestamp: Math.round(Date.now() / 1000)
  })

  await db('rosters_players').insert({
    rid: rosterId,
    player: player.player,
    slot,
    pos: player.pos1
  })
}
