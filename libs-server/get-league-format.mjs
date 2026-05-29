import db from '#db'

export default async function ({ league_format_id }) {
  return db('league_formats')
    .leftJoin(
      'league_scoring_formats',
      'league_formats.scoring_format_id',
      'league_scoring_formats.id'
    )
    .where('league_formats.id', league_format_id)
    .select(
      'league_formats.*',
      'league_scoring_formats.*',
      'league_formats.id as league_format_id',
      'league_scoring_formats.id as scoring_format_id'
    )
    .first()
}
