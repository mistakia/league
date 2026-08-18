import db from '#db'
import { current_season } from '#constants'

export default async function (tid) {
  const teams = await db('teams').where({
    team_id: tid,
    season_year: current_season.year
  })
  return teams[0]
}
