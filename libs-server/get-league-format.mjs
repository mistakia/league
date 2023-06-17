import db from '#db'

export default async function ({ league_format_hash }) {
  return db('league_formats')
    .leftJoin(
      'league_scoring_formats',
      'league_formats.scoring_format_hash',
      'league_scoring_formats.scoring_format_hash'
    )
    .where({ league_format_hash })
    .first()
}
