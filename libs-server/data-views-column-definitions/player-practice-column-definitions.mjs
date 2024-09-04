import db from '#db'
import get_table_hash from '#libs-server/get-table-hash.mjs'
import data_view_join_function from '#libs-server/data-views/data-view-join-function.mjs'
import { constants } from '#libs-shared'

const valid_practice_days = ['m', 'tu', 'w', 'th', 'f', 's', 'su']

const get_params = ({ params = {} }) => {
  let year = params.year || [constants.season.year]
  if (!Array.isArray(year)) {
    year = [year]
  }

  let week = params.week || [Math.max(constants.season.week, 1)]
  if (!Array.isArray(week)) {
    week = [week]
  }

  let practice_day = params.practice_day || ['w']
  if (!Array.isArray(practice_day)) {
    practice_day = [practice_day]
  }

  // remove invalid practice days
  practice_day = practice_day.filter((day) => valid_practice_days.includes(day))

  return {
    year,
    week,
    practice_day
  }
}

const generate_table_alias = ({ params = {} } = {}) => {
  const { year, week } = get_params({ params })
  const key = `player_practice_${year}_${week}`
  return get_table_hash(key)
}

const add_player_practice_with_statement = ({
  query,
  params = {},
  with_table_name,
  where_clauses = []
}) => {
  const { year, week } = get_params({ params })

  const with_query = db('practice')
    .select(
      'pid',
      'formatted_status',
      'inj',
      'm',
      'tu',
      'w',
      'th',
      'f',
      's',
      'su'
    )
    .whereIn('year', year)
    .whereIn('week', week)

  if (where_clauses.length) {
    for (const where_clause of where_clauses) {
      with_query.whereRaw(where_clause)
    }
  }

  query.with(with_table_name, with_query)
}

const create_player_practice_field = (field, alias) => ({
  column_name: field,
  table_name: 'practice',
  select_as: () => alias,
  table_alias: generate_table_alias,
  join: data_view_join_function,
  with: add_player_practice_with_statement,
  supported_splits: ['year', 'week'],
  with_where: ({ table_name }) => `${table_name}.${field}`
})

const create_player_practice_designation_field = (practice_day) => ({
  column_name: practice_day,
  table_name: 'practice',
  with_select: () => [`${practice_day}`],
  select_as: () => `player_practice_designation_${practice_day}`,
  table_alias: generate_table_alias,
  join: data_view_join_function,
  with: add_player_practice_with_statement,
  supported_splits: ['year', 'week'],
  with_where: () => practice_day
})

export default {
  player_practice_status: create_player_practice_field(
    'formatted_status',
    'practice_status'
  ),
  player_practice_injury: create_player_practice_field(
    'inj',
    'practice_injury'
  ),
  player_practice_designation_monday:
    create_player_practice_designation_field('m'),
  player_practice_designation_tuesday:
    create_player_practice_designation_field('tu'),
  player_practice_designation_wednesday:
    create_player_practice_designation_field('w'),
  player_practice_designation_thursday:
    create_player_practice_designation_field('th'),
  player_practice_designation_friday:
    create_player_practice_designation_field('f'),
  player_practice_designation_saturday:
    create_player_practice_designation_field('s'),
  player_practice_designation_sunday:
    create_player_practice_designation_field('su')
}
