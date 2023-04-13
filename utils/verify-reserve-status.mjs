import db from '#db'
import getRoster from './get-roster.mjs'
import getLeague from './get-league.mjs'
import {
  constants,
  Roster,
  isReserveEligible,
  isReserveCovEligible
} from '#common'

export default async function ({ teamId, leagueId }) {
  const league = await getLeague({ lid: leagueId })
  const rosterRow = await getRoster({ tid: teamId })
  const roster = new Roster({ roster: rosterRow, league })
  const reserve_pids = roster.reserve.map((p) => p.pid)

  const player_rows = await db('player').whereIn('pid', reserve_pids)

  for (const roster_player of roster.reserve) {
    const player_row = player_rows.find((p) => p.pid === roster_player.pid)
    if (!player_row) {
      throw new Error('Reserve player violation')
    }

    const { status, injury_status } = player_row

    if (
      roster_player.slot === constants.slots.IR &&
      !isReserveEligible({ status, injury_status })
    ) {
      throw new Error('Reserve player violation')
    } else if (
      roster_player.slot === constants.slots.COV &&
      !isReserveCovEligible({ status, injury_status })
    ) {
      throw new Error('Reserve player violation')
    }
  }
}
