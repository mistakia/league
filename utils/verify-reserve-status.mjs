import db from '#db'
import getRoster from './get-roster.mjs'
import {
  constants,
  Roster,
  isReserveEligible,
  isReserveCovEligible
} from '#common'

export default async function ({ teamId, leagueId }) {
  const leagues = await db('leagues').where({ uid: leagueId })
  const league = leagues[0]
  const rosterRow = await getRoster({ tid: teamId })
  const roster = new Roster({ roster: rosterRow, league })
  const reservePlayerIds = roster.reserve.map((p) => p.player)

  const players = await db('player').whereIn('player', reservePlayerIds)

  for (const player of roster.reserve) {
    const playerItem = players.find((p) => p.player === player.player)
    if (!playerItem) {
      throw new Error('Reserve player violation')
    }

    if (player.slot === constants.slots.IR && !isReserveEligible(playerItem)) {
      throw new Error('Reserve player violation')
    } else if (
      player.slot === constants.slots.COV &&
      !isReserveCovEligible(playerItem)
    ) {
      throw new Error('Reserve player violation')
    }
  }
}
