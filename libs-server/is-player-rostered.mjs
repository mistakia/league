import db from '#db'
import { current_season } from '#constants'

export default async function ({ pid, leagueId }) {
  const rosterRows = await db('rosters_players').where({
    pid,
    lid: leagueId,
    week: current_season.week,
    year: current_season.year
  })

  return Boolean(rosterRows.length)
}
