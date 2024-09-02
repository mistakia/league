import COLUMN_GROUPS from './column-groups'
import * as table_constants from 'react-table/src/constants.mjs'
import { constants, common_column_params } from '#libs-shared'

const { year, week, career_year, career_game } = common_column_params

const create_player_dfs_salaries_field = (props) => ({
  ...props,
  column_groups: [COLUMN_GROUPS.DFS_SALARIES],
  size: 70,
  data_type: table_constants.TABLE_DATA_TYPES.NUMBER,
  column_params: {
    year: {
      ...year,
      single: true,
      default_value: constants.year,
      enable_multi_on_split: ['year']
    },
    week: {
      ...week,
      single: true,
      default_value: 1,
      enable_multi_on_split: ['week']
    },
    platform_source_id: {
      values: ['DRAFTKINGS'],
      data_type: table_constants.TABLE_DATA_TYPES.SELECT,
      single: true,
      default_value: 'DRAFTKINGS',
      label: 'Platform'
    },
    career_year,
    career_game
  },
  splits: ['year', 'week'],
  with_where: () => 'player_salaries.salary'
})

export default {
  player_dfs_salary: create_player_dfs_salaries_field({
    column_title: 'DFS Salary',
    header_label: 'Salary',
    player_value_path: 'dfs_salary'
  })
}
