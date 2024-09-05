import db from '#db'
import { constants, createDefaultLeague } from '#libs-shared'

async function get_league_divisions({ lid, year }) {
  const divisions = await db('league_divisions')
    .where({ lid, year })
    .select('division_id', 'division_name')

  return divisions.reduce((acc, div) => {
    acc[`division_${div.division_id}_name`] = div.division_name
    return acc
  }, {})
}

export default async function ({ lid, year = constants.season.year } = {}) {
  lid = Number(lid)

  if (!lid) {
    const league = createDefaultLeague()
    return { uid: 0, ...league }
  }

  const league = await db('leagues')
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

  if (league) {
    const divisions = await get_league_divisions({ lid, year })
    return { ...league, ...divisions }
  }

  return league
}
