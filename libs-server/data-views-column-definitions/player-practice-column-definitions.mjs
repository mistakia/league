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
  // Grain 'player': the nfl_week_id filter collapses to one row per player,
  // so pid-only equality is the correct join predicate regardless of the
  // cell's split shape.
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

// `day_suffix` is the exposed field suffix (e.g. player_practice_designation_m)
// and is pinned independently of `column_name` -- deriving it from the renamed
// physical column would change the output field name for every saved view.
const create_player_practice_designation_field = (column_name, day_suffix) => ({
  column_name,
  select_as: () => `player_practice_designation_${day_suffix}`,
  table_alias: generate_table_alias,
  source: player_practice_source,
  get_cache_info
})

export default {
  // Participation level (FP/LP/DNP), which is NOT what `game_designation`
  // holds (PROBABLE/QUESTIONABLE/OUT/DOUBTFUL). b69d64899 added the two
  // roster_status/game_designation columns and dropped this definition, but
  // the physical `practice_status` column stayed and is still written --
  // 53,364 of 85,080 rows carry a value. Dropping the definition orphaned the
  // frontend field, the description index entry, and every saved view holding
  // the id, none of which that commit touched.
  player_practice_status: create_player_practice_field(
    'practice_status',
    'practice_status'
  ),
  player_practice_game_designation: create_player_practice_field(
    'game_designation',
    'practice_game_designation'
  ),
  player_practice_roster_status: create_player_practice_field(
    'roster_status',
    'practice_roster_status'
  ),
  player_practice_injury: create_player_practice_field(
    'injury_type',
    'practice_injury'
  ),
  player_practice_designation_monday: create_player_practice_designation_field(
    'monday_practice_status',
    'm'
  ),
  player_practice_designation_tuesday: create_player_practice_designation_field(
    'tuesday_practice_status',
    'tu'
  ),
  player_practice_designation_wednesday:
    create_player_practice_designation_field('wednesday_practice_status', 'w'),
  player_practice_designation_thursday:
    create_player_practice_designation_field('thursday_practice_status', 'th'),
  player_practice_designation_friday: create_player_practice_designation_field(
    'friday_practice_status',
    'f'
  ),
  player_practice_designation_saturday:
    create_player_practice_designation_field('saturday_practice_status', 's'),
  player_practice_designation_sunday: create_player_practice_designation_field(
    'sunday_practice_status',
    'su'
  )
}
