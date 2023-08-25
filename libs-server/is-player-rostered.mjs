import db from '#db'
import { constants } from '#libs-shared'

export default async function ({ pid, leagueId }) {
  const rosterRows = await db('rosters_players').where({
    pid,
    lid: leagueId,
    week: constants.season.week,
    year: constants.season.year
  })

  return Boolean(rosterRows.length)
}
