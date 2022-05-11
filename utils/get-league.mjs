import db from '#db'
import { constants, createDefaultLeague } from '#common'

export default async function (leagueId) {
  if (!leagueId) {
    const league = createDefaultLeague({ userId: 0 })
    return { uid: 0, ...league }
  }

  const leagues = await db('leagues')
    .leftJoin('seasons', function () {
      this.on('leagues.uid', '=', 'seasons.lid')
      this.on(
        db.raw(
          `seasons.year = ${constants.season.year} or seasons.year is null`
        )
      )
    })
    .where({ uid: leagueId })
  return leagues[0]
}
