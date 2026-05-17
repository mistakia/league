import get_table_hash from '#libs-server/data-views/get-table-hash.mjs'
import { create_frequent_update_cache_info } from '#libs-server/data-views/cache-info-utils.mjs'
import resolve_single_nfl_week_id from '#libs-server/data-views/resolve-single-nfl-week-id.mjs'

const valid_practice_days = ['m', 'tu', 'w', 'th', 'f', 's', 'su']

const get_params = ({ params = {} }) => {
  const nfl_week_id = resolve_single_nfl_week_id({ params })
  const nfl_week = [nfl_week_id]

  let practice_day = params.practice_day || ['w']
  if (!Array.isArray(practice_day)) {
    practice_day = [practice_day]
  }

  // remove invalid practice days
  practice_day = practice_day.filter((day) => valid_practice_days.includes(day))

  return {
    nfl_week,
    practice_day
  }
}

const get_cache_info = create_frequent_update_cache_info({ get_params })

const generate_table_alias = ({ params = {} } = {}) => {
  const { nfl_week } = get_params({ params })
  const key = `player_practice_${nfl_week.join('_')}`
  return get_table_hash(key)
}

const player_practice_source = {
  table: 'practice',
  // Grain 'player': legacy data_view_join_function emitted pid-only equality
  // regardless of cell granularity; the nfl_week_id filter collapses to one
  // row per player.
  grain: 'player',
  key_columns: { pid: 'pid' },
  extra_predicates: (params) => [
    { column: 'nfl_week_id', op: 'in', value: get_params({ params }).nfl_week }
  ]
}

const create_player_practice_field = (field, alias) => ({
  column_name: field,
  select_as: () => alias,
  table_alias: generate_table_alias,
  source: player_practice_source,
  get_cache_info
})

const create_player_practice_designation_field = (practice_day) => ({
  column_name: practice_day,
  select_as: () => `player_practice_designation_${practice_day}`,
  table_alias: generate_table_alias,
  source: player_practice_source,
  get_cache_info
})

export default {
  player_practice_game_designation: create_player_practice_field(
    'game_designation',
    'practice_game_designation'
  ),
  player_practice_roster_status: create_player_practice_field(
    'roster_status',
    'practice_roster_status'
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
