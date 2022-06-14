import db from '#db'
import { constants } from '#common'

export default async function ({ pid, leagueId }) {
  const rosterRows = await db('rosters_players')
    .join('rosters', 'rosters_players.rid', 'rosters.uid')
    .where({
      pid,
      lid: leagueId,
      week: constants.season.week,
      year: constants.season.year
    })

  return Boolean(rosterRows.length)
}
