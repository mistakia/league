import db from '#db'
import { current_season } from '#constants'

export default async function (tid) {
  const teams = await db('teams').where({
    uid: tid,
    year: current_season.year
  })
  return teams[0]
}
