import db from '#db'
import { current_season } from '#constants'
import { create_default_league } from '#libs-shared'

async function get_league_divisions({ lid, year }) {
  const divisions = await db('league_divisions')
    .where({ lid, year })
    .select('division_id', 'division_name')

  return divisions.reduce((acc, div) => {
    acc[`division_${div.division_id}_name`] = div.division_name
    return acc
  }, {})
}

export default async function ({ lid, year = current_season.year } = {}) {
  lid = Number(lid)

  // `year` is spliced into the join predicate below as raw SQL, so it gets the
  // same coercion `lid` already has. Callers reach this from request input --
  // notably the unauthenticated data-view search route, via the league roster
  // join -- and an uncoerced year was a live injection path.
  const parsed_year = Number(year)
  year = Number.isInteger(parsed_year) ? parsed_year : current_season.year

  if (!lid) {
    const league = create_default_league()
    return { uid: 0, ...league }
  }

  const league = await db('leagues')
    .leftJoin('seasons', function () {
      this.on('leagues.uid', '=', 'seasons.lid')
      this.on(db.raw(`seasons.year = ${year} or seasons.year is null`))
    })
    .leftJoin('league_formats', 'seasons.league_format_id', 'league_formats.id')
    .leftJoin(
      'league_scoring_formats',
      'seasons.scoring_format_id',
      'league_scoring_formats.id'
    )
    .where('leagues.uid', lid)
    .first()

  if (league) {
    const divisions = await get_league_divisions({ lid, year })
    return { ...league, ...divisions }
  }

  return league
}
