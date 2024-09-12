import React from 'react'

import PlayerRowStatusColumn from '@components/player-row-status-column'
import COLUMN_GROUPS from './column-groups'
import * as table_constants from 'react-table/src/constants.mjs'
import { common_column_params } from '@libs-shared'

const { single_year, single_week } = common_column_params

export default function ({ week }) {
  return {
    player_league_roster_status: {
      column_title: 'Roster Status',
      header_label: '',
      size: 50,
      component: React.memo(PlayerRowStatusColumn),
      data_type: table_constants.TABLE_DATA_TYPES.SELECT,
      sticky: true,
      column_values: [
        'free_agent',
        'active_roster',
        'practice_squad',
        'injured_reserve'
      ]
    },

    player_league_salary: {
      column_title: 'Player Salary',
      column_groups: [COLUMN_GROUPS.FANTASY_LEAGUE],
      header_label: 'Salary',
      player_value_path: 'player_salary',
      size: 70,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER
    },

    player_week_projected_market_salary: {
      column_title: 'Projected Market Salary',
      column_groups: [
        COLUMN_GROUPS.PROJECTION,
        COLUMN_GROUPS.WEEK_PROJECTION,
        COLUMN_GROUPS.FANTASY_LEAGUE
      ],
      header_label: 'Market',
      player_value_path: 'week_projected_market_salary',
      size: 70,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER,
      column_params: {
        year: single_year,
        week: single_week
      }
    },

    player_season_projected_inflation_adjusted_market_salary: {
      column_title: 'Inflation Adj. Projected Market Salary',
      column_groups: [
        COLUMN_GROUPS.PROJECTION,
        COLUMN_GROUPS.SEASON_PROJECTION,
        COLUMN_GROUPS.FANTASY_LEAGUE
      ],
      header_label: 'Adjusted',
      player_value_path: 'season_projected_inflation_adjusted_market_salary',
      size: 70,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER
    },

    player_week_projected_salary_adjusted_points_added: {
      column_title: 'Salary Adj. Points Added (Week)',
      column_groups: [
        COLUMN_GROUPS.PROJECTION,
        COLUMN_GROUPS.WEEK_PROJECTION,
        COLUMN_GROUPS.FANTASY_LEAGUE
      ],
      header_label: 'Value',
      player_value_path: 'week_projected_salary_adjusted_points_added',
      size: 70,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER
    },

    player_season_projected_salary_adjusted_points_added: {
      column_title: 'Salary Adj. Points Added (Season)',
      column_groups: [
        COLUMN_GROUPS.PROJECTION,
        COLUMN_GROUPS.SEASON_PROJECTION,
        COLUMN_GROUPS.FANTASY_LEAGUE
      ],
      header_label: 'Value',
      player_value_path: 'season_projected_salary_adjusted_points_added',
      size: 70,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER
    },

    player_rest_of_season_projected_salary_adjusted_points_added: {
      column_title: 'Salary Adj. Points Added (Rest-Of-Season)',
      column_groups: [
        COLUMN_GROUPS.PROJECTION,
        COLUMN_GROUPS.REST_OF_SEASON_PROJECTION,
        COLUMN_GROUPS.FANTASY_LEAGUE
      ],
      header_label: 'Value',
      player_value_path:
        'rest_of_season_projected_salary_adjusted_points_added',
      size: 70,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER
    }
  }
}
