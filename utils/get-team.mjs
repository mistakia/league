import db from '#db'
import { constants } from '#common'

export default async function (tid) {
  const teams = await db('teams').where({
    uid: tid,
    year: constants.season.year
  })
  return teams[0]
}
