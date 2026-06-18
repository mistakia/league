import { current_season } from '#constants'
import get_table_hash from '#libs-server/data-views/get-table-hash.mjs'
import { create_season_aggregate_cache_info } from '#libs-server/data-views/cache-info-utils.mjs'
import { team_year_offset_range_select } from '#libs-server/data-views/param-utils.mjs'

const get_default_params = ({ params = {} } = {}) => {
  let year = params.year || [current_season.stats_season_year]
  if (!Array.isArray(year)) {
    year = [year]
  }

  const matchup_opponent_type = Array.isArray(params.matchup_opponent_type)
    ? params.matchup_opponent_type[0]
    : params.matchup_opponent_type

  return { year, matchup_opponent_type }
}

const get_cache_info = create_season_aggregate_cache_info({
  get_params: ({ params = {} } = {}) => {
    const { year } = get_default_params({ params })
    return { year, week: [] }
  }
})

const pff_team_seasonlogs_table_alias = ({ params = {} } = {}) => {
  const { year, matchup_opponent_type } = get_default_params({ params })
  const suffix = matchup_opponent_type ? `_${matchup_opponent_type}` : ''
  return get_table_hash(`pff_team_seasonlogs_${year.join('_')}${suffix}`)
}

const pff_team_source = {
  table: 'pff_team_seasonlogs',
  grain: 'team_year',
  key_columns: { team: 'nfl_team', year: 'year' },
  year_default: (params) => [get_default_params({ params }).year[0]]
}

// PFF grades are 0-100 quality scores; record/scoring counts (wins, losses,
// ties, points) accumulate. A range year_offset AVGs the grades across the
// window and SUMs the counts. The custom main_select reads the source JOIN
// alias, which get-data-view-results drops for a range offset with no
// where-clause, so the offset path needs a self-contained subquery instead;
// select_as makes the offset alias match the non-offset display name.
const create_pff_team_field = (
  column_name,
  display_name,
  range_offset_aggregate = 'AVG'
) => ({
  column_name,
  table_name: 'pff_team_seasonlogs',
  table_alias: pff_team_seasonlogs_table_alias,
  source: pff_team_source,
  range_offset_aggregate,
  select_as: () => display_name,
  get_cache_info,
  main_select: ({ table_name, column_index }) => [
    `${table_name}.${column_name} as ${display_name}_${column_index}`
  ],
  main_group_by: ({ table_name }) => [`${table_name}.${column_name}`],
  main_select_string_year_offset_range: ({
    params,
    data_view_options,
    query_context
  }) =>
    team_year_offset_range_select({
      table: 'pff_team_seasonlogs',
      column: column_name,
      source: pff_team_source,
      params,
      data_view_options,
      query_context,
      aggregate: range_offset_aggregate
    })
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

  // Team record and scoring stats -- additive counts, so a range year_offset
  // SUMs across the window rather than averaging.
  pff_team_wins: create_pff_team_field('wins', 'pff_team_wins', 'SUM'),
  pff_team_losses: create_pff_team_field('losses', 'pff_team_losses', 'SUM'),
  pff_team_ties: create_pff_team_field('ties', 'pff_team_ties', 'SUM'),
  pff_team_points_scored: create_pff_team_field(
    'points_scored',
    'pff_team_points_scored',
    'SUM'
  ),
  pff_team_points_allowed: create_pff_team_field(
    'points_allowed',
    'pff_team_points_allowed',
    'SUM'
  )
}
