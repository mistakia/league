import get_join_func from '#libs-server/get-join-func.mjs'
import get_table_hash from '#libs-server/get-table-hash.mjs'
import nfl_plays_column_params from '#libs-shared/nfl-plays-column-params.mjs'

const generate_table_alias = ({ params = {} } = {}) => {
  const column_param_keys = Object.keys(nfl_plays_column_params).sort()
  const key = column_param_keys
    .map((key) => {
      const value = params[key]
      return Array.isArray(value)
        ? `${key}${value.sort().join('')}`
        : `${key}${value || ''}`
    })
    .join('')

  return get_table_hash(`team_stats_from_plays__${key}`)
}

// TODO get table_name
const join_filtered_plays_table = ({
  query,
  join_type = 'LEFT',
  splits = [],
  previous_table_name = null,
  params = {},
  table_name
}) => {
  const join_func = get_join_func(join_type)
  let year_offset = params.year_offset || 0
  if (Array.isArray(year_offset)) {
    year_offset = year_offset[0]
  }

  query[join_func](`${table_name}_player_team_stats`, function () {
    this.on('player.pid', '=', `${table_name}_player_team_stats.pid`)

    if (splits.includes('year')) {
      if (previous_table_name) {
        this.andOn(
          query.raw(
            `${table_name}_player_team_stats.year = ${previous_table_name}.year + ?`,
            [year_offset]
          )
        )
      } else if (params.year) {
        const year_array = Array.isArray(params.year)
          ? params.year
          : [params.year]
        this.whereIn(
          `${table_name}_player_team_stats.year`,
          year_array.map((y) => y + year_offset)
        )
      }
    }

    for (const split of splits) {
      if (split !== 'year' && previous_table_name) {
        this.andOn(
          `${table_name}_player_team_stats.${split}`,
          '=',
          `${previous_table_name}.${split}`
        )
      }
    }
  })
}

const team_stat_from_plays = ({ select_string, stat_name }) => ({
  table_alias: generate_table_alias,
  column_name: stat_name,
  select: () => [`${select_string} AS ${stat_name}_0`],
  where_column: () => select_string,
  use_team_stats_play_by_play_with: true,
  join: join_filtered_plays_table,
  use_having: true,
  supported_splits: ['years'],
  supported_rate_types: ['per_game']
})

export default {
  team_pass_yards_from_plays: team_stat_from_plays({
    select_string: `SUM(pass_yds)`,
    stat_name: 'team_pass_yds_from_plays'
  }),
  team_pass_attempts_from_plays: team_stat_from_plays({
    select_string: `SUM(CASE WHEN psr_pid IS NOT NULL AND (sk IS NULL OR sk = false) THEN 1 ELSE 0 END)`,
    stat_name: 'team_pass_att_from_plays'
  }),
  team_pass_completions_from_plays: team_stat_from_plays({
    select_string: `SUM(CASE WHEN comp = true THEN 1 ELSE 0 END)`,
    stat_name: 'team_pass_comp_from_plays'
  }),
  team_pass_touchdowns_from_plays: team_stat_from_plays({
    select_string: `SUM(CASE WHEN td = true THEN 1 ELSE 0 END)`,
    stat_name: 'team_pass_td_from_plays'
  }),
  team_pass_air_yards_from_plays: team_stat_from_plays({
    select_string: `SUM(dot)`,
    stat_name: 'team_pass_air_yds_from_plays'
  }),
  team_rush_yards_from_plays: team_stat_from_plays({
    select_string: `SUM(rush_yds)`,
    stat_name: 'team_rush_yds_from_plays'
  }),
  team_rush_attempts_from_plays: team_stat_from_plays({
    select_string: `COUNT(CASE WHEN bc_pid IS NOT NULL THEN 1 ELSE NULL END)`,
    stat_name: 'team_rush_att_from_plays'
  }),
  team_rush_touchdowns_from_plays: team_stat_from_plays({
    select_string: `SUM(CASE WHEN td = true AND bc_pid IS NOT NULL THEN 1 ELSE 0 END)`,
    stat_name: 'team_rush_td_from_plays'
  }),
  team_expected_points_added_from_plays: team_stat_from_plays({
    select_string: `SUM(epa)`,
    stat_name: 'team_ep_added_from_plays'
  })
}
