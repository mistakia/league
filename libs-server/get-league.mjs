import db from '#db'
import { constants, createDefaultLeague } from '#libs-shared'

export default async function ({ lid, year = constants.season.year } = {}) {
  lid = Number(lid)

  if (!lid) {
    const league = createDefaultLeague()
    return { uid: 0, ...league }
  }

  return db('leagues')
    .leftJoin('seasons', function () {
      this.on('leagues.uid', '=', 'seasons.lid')
      this.on(db.raw(`seasons.year = ${year} or seasons.year is null`))
    })
    .leftJoin(
      'league_formats',
      'seasons.league_format_hash',
      'league_formats.league_format_hash'
    )
    .leftJoin(
      'league_scoring_formats',
      'seasons.scoring_format_hash',
      'league_scoring_formats.scoring_format_hash'
    )
    .where('leagues.uid', lid)
    .first()
}
