import db from '#db'
import { constants, createDefaultLeague } from '#common'

export default async function ({ lid, year = constants.season.year } = {}) {
  if (!lid) {
    const league = createDefaultLeague()
    return { uid: 0, ...league }
  }

  const leagues = await db('leagues')
    .leftJoin('seasons', function () {
      this.on('leagues.uid', '=', 'seasons.lid')
      this.on(db.raw(`seasons.year = ${year} or seasons.year is null`))
    })
    .where({ uid: lid })
  return leagues[0]
}
