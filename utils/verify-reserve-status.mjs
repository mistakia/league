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
  const reserve_pids = roster.reserve.map((p) => p.pid)

  const player_rows = await db('player').whereIn('pid', reserve_pids)

  for (const roster_player of roster.reserve) {
    const player_row = player_rows.find((p) => p.pid === roster_player.pid)
    if (!player_row) {
      throw new Error('Reserve player violation')
    }

    if (
      roster_player.slot === constants.slots.IR &&
      !isReserveEligible(player_row)
    ) {
      throw new Error('Reserve player violation')
    } else if (
      roster_player.slot === constants.slots.COV &&
      !isReserveCovEligible(player_row)
    ) {
      throw new Error('Reserve player violation')
    }
  }
}
