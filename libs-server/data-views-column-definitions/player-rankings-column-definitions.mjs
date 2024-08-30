import db from '#db'
import get_table_hash from '#libs-server/get-table-hash.mjs'
import data_view_join_function from '#libs-server/data-views/data-view-join-function.mjs'
import { constants } from '#libs-shared'

const generate_table_alias = ({ params = {} } = {}) => {
  let year = params.year || [constants.season.year]
  if (!Array.isArray(year)) {
    year = [year]
  }

  let week = params.week || [constants.season.week]
  if (!Array.isArray(week)) {
    week = [week]
  }

  const key = `player_rankings_${year.join('_')}_${week.join('_')}`
  return get_table_hash(key)
}

const add_player_rankings_with_statement = ({
  query,
  params = {},
  with_table_name,
  where_clauses = [],
  select_strings = []
}) => {
  let year = params.year || [constants.season.year]
  if (!Array.isArray(year)) {
    year = [year]
  }

  let week = params.week || [constants.season.week]
  if (!Array.isArray(week)) {
    week = [week]
  }

  let ranking_source_id = params.ranking_source_id || ['FANTASYPROS']
  if (!Array.isArray(ranking_source_id)) {
    ranking_source_id = [ranking_source_id]
  }

  let ranking_type = params.ranking_type || 'PPR_REDRAFT'
  if (!Array.isArray(ranking_type)) {
    ranking_type = [ranking_type]
  }

  const with_query = db('player_rankings_index')
    .select('pid')
    .whereIn('source_id', ranking_source_id)
    .whereIn('ranking_type', ranking_type)
    .whereIn('year', year)
    .whereIn('week', week)

  if (select_strings.length) {
    for (const select_string of select_strings) {
      with_query.select(db.raw(select_string))
    }
  }

  if (where_clauses.length) {
    for (const where_clause of where_clauses) {
      with_query.whereRaw(where_clause)
    }
  }

  query.with(with_table_name, with_query)
}

const create_player_rankings_field = (field, select_as) => ({
  column_name: field,
  select_as: () => select_as,
  table_name: 'player_rankings_index',
  table_alias: generate_table_alias,
  join: data_view_join_function,
  with: add_player_rankings_with_statement,
  supported_splits: ['year', 'week'],
  with_where: () => `player_rankings_index.${field}`
})

export default {
  player_average_ranking: create_player_rankings_field('avg', 'average_rank'),
  player_overall_ranking: create_player_rankings_field(
    'overall_rank',
    'overall_rank'
  ),
  player_position_ranking: create_player_rankings_field(
    'position_rank',
    'position_rank'
  ),
  player_min_ranking: create_player_rankings_field('min', 'min_rank'),
  player_max_ranking: create_player_rankings_field('max', 'max_rank'),
  player_ranking_standard_deviation: create_player_rankings_field(
    'std',
    'rank_stddev'
  )
}
