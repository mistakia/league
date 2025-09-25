import { constants } from '#libs-shared'
import get_table_hash from '#libs-server/data-views/get-table-hash.mjs'
import data_view_join_function from '#libs-server/data-views/data-view-join-function.mjs'
import { create_season_aggregate_cache_info } from '#libs-server/data-views/cache-info-utils.mjs'

const get_default_params = ({ params = {} } = {}) => {
  let year = params.year || [constants.season.stats_season_year]
  if (!Array.isArray(year)) {
    year = [year]
  }

  return { year }
}

const get_cache_info = create_season_aggregate_cache_info({
  get_params: ({ params = {} } = {}) => {
    const { year } = get_default_params({ params })
    return { year, week: [] }
  }
})

const pff_team_seasonlogs_table_alias = ({ params = {} } = {}) => {
  const { year } = get_default_params({ params })
  return get_table_hash(`pff_team_seasonlogs_${year.join('_')}`)
}

const pff_team_seasonlogs_join = (join_arguments) => {
  data_view_join_function({
    ...join_arguments,
    join_year: true,
    default_year: constants.season.stats_season_year,
    join_on_team: true,
    join_table_clause: `pff_team_seasonlogs as ${join_arguments.table_name}`
  })
}

const create_pff_team_field = (column_name, display_name) => ({
  column_name,
  table_name: 'pff_team_seasonlogs',
  table_alias: pff_team_seasonlogs_table_alias,
  join: pff_team_seasonlogs_join,
  supported_splits: ['year'],
  get_cache_info,
  main_select: ({ table_name, column_index }) => [
    `${table_name}.${column_name} as ${display_name}_${column_index}`
  ],
  main_group_by: ({ table_name }) => [`${table_name}.${column_name}`]
})

export default {
  // PFF Grade columns
  pff_team_grades_offense: create_pff_team_field(
    'grades_offense',
    'pff_team_grades_offense'
  ),
  pff_team_grades_defense: create_pff_team_field(
    'grades_defense',
    'pff_team_grades_defense'
  ),
  pff_team_grades_special_teams: create_pff_team_field(
    'grades_special_teams',
    'pff_team_grades_special_teams'
  ),
  pff_team_grades_overall: create_pff_team_field(
    'grades_overall',
    'pff_team_grades_overall'
  ),
  pff_team_grades_pass: create_pff_team_field(
    'grades_pass',
    'pff_team_grades_pass'
  ),
  pff_team_grades_run: create_pff_team_field(
    'grades_run',
    'pff_team_grades_run'
  ),
  pff_team_grades_pass_block: create_pff_team_field(
    'grades_pass_block',
    'pff_team_grades_pass_block'
  ),
  pff_team_grades_pass_rush_defense: create_pff_team_field(
    'grades_pass_rush_defense',
    'pff_team_grades_pass_rush_defense'
  ),
  pff_team_grades_run_defense: create_pff_team_field(
    'grades_run_defense',
    'pff_team_grades_run_defense'
  ),
  pff_team_grades_run_block: create_pff_team_field(
    'grades_run_block',
    'pff_team_grades_run_block'
  ),
  pff_team_grades_coverage_defense: create_pff_team_field(
    'grades_coverage_defense',
    'pff_team_grades_coverage_defense'
  ),
  pff_team_grades_tackle: create_pff_team_field(
    'grades_tackle',
    'pff_team_grades_tackle'
  ),
  pff_team_grades_pass_route: create_pff_team_field(
    'grades_pass_route',
    'pff_team_grades_pass_route'
  ),

  // Team record and scoring stats
  pff_team_wins: create_pff_team_field('wins', 'pff_team_wins'),
  pff_team_losses: create_pff_team_field('losses', 'pff_team_losses'),
  pff_team_ties: create_pff_team_field('ties', 'pff_team_ties'),
  pff_team_points_scored: create_pff_team_field(
    'points_scored',
    'pff_team_points_scored'
  ),
  pff_team_points_allowed: create_pff_team_field(
    'points_allowed',
    'pff_team_points_allowed'
  )
}
