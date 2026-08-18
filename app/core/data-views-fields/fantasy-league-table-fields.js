import React from 'react'

import PlayerRowStatusColumn from '@components/player-row-status-column'
import COLUMN_GROUPS from './column-groups'
import * as table_constants from 'react-table/src/constants.mjs'
import { common_column_params } from '#libs-shared'

const { single_nfl_week_id } = common_column_params

export default function ({ week, is_logged_in, fantasy_teams = [] }) {
  const fields = {
    player_league_roster_status: {
      column_title: 'Roster Status',
      header_label: '',
      size: 50,
      component: React.memo(PlayerRowStatusColumn),
      data_type: table_constants.TABLE_DATA_TYPES.SELECT,
      column_values: [
        'free_agent',
        'active_roster',
        'practice_squad',
        'injured_reserve'
      ]
    },

    player_league_roster_tag: {
      column_title: 'Roster Tag',
      column_groups: [COLUMN_GROUPS.FANTASY_LEAGUE],
      header_label: 'Tag',
      size: 90,
      data_type: table_constants.TABLE_DATA_TYPES.SELECT,
      column_values: [
        'regular',
        'franchise',
        'rookie',
        'restricted_free_agency'
      ]
    },

    // Filter values are team ids, not team names: names are editable and change
    // year to year, so a name-based filter silently stops matching. The picker
    // labels each id with the team's current name.
    player_league_fantasy_team: {
      column_title: 'Fantasy Team',
      column_groups: [COLUMN_GROUPS.FANTASY_LEAGUE],
      header_label: 'Team',
      size: 140,
      data_type: table_constants.TABLE_DATA_TYPES.SELECT,
      column_values: fantasy_teams,
      operators: [
        table_constants.TABLE_OPERATORS.IN,
        table_constants.TABLE_OPERATORS.NOT_IN,
        table_constants.TABLE_OPERATORS.IS_NULL,
        table_constants.TABLE_OPERATORS.IS_NOT_NULL
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

    player_league_extended_salary: {
      column_title: 'Player Extended Salary',
      column_groups: [COLUMN_GROUPS.FANTASY_LEAGUE],
      header_label: 'Ext Salary',
      player_value_path: 'extended_salary',
      size: 80,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER
    },

    // Populated only for a regular roster tag. Null for franchise, rookie, and
    // restricted free agency by design. See the column definition for why each.
    player_league_extended_salary_over_market: {
      column_title: 'Extended Salary Over Market',
      column_groups: [COLUMN_GROUPS.FANTASY_LEAGUE],
      header_label: 'Over Market',
      size: 90,
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
        single_nfl_week_id
      }
    },

    player_season_projected_positive_salary_at_available_cap: {
      column_title: 'Projected Positive Salary at Available Cap',
      column_groups: [
        COLUMN_GROUPS.PROJECTION,
        COLUMN_GROUPS.SEASON_PROJECTION,
        COLUMN_GROUPS.FANTASY_LEAGUE
      ],
      header_label: 'Available Cap',
      // This entry's select_as is the only one in its file carrying a `player_`
      // prefix, so the server emits the id verbatim while this read once omitted
      // it and rendered a blank cell. Matching the client keeps the payload key
      // stable for cached results.
      player_value_path:
        'player_season_projected_positive_salary_at_available_cap',
      size: 70,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER
    },

    player_week_projected_points_added_positive_including_cap_savings: {
      column_title: 'Projected Points Added incl. Cap Savings (Week)',
      column_groups: [
        COLUMN_GROUPS.PROJECTION,
        COLUMN_GROUPS.WEEK_PROJECTION,
        COLUMN_GROUPS.FANTASY_LEAGUE
      ],
      header_label: 'Value',
      player_value_path: 'week_points_added_positive_including_cap_savings',
      size: 70,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER
    },

    player_season_projected_points_added_positive_including_cap_savings: {
      column_title: 'Projected Points Added incl. Cap Savings (Season)',
      column_groups: [
        COLUMN_GROUPS.PROJECTION,
        COLUMN_GROUPS.SEASON_PROJECTION,
        COLUMN_GROUPS.FANTASY_LEAGUE
      ],
      header_label: 'Value',
      player_value_path: 'season_points_added_positive_including_cap_savings',
      size: 70,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER
    },

    player_rest_of_season_projected_points_added_positive_including_cap_savings:
      {
        column_title:
          'Projected Points Added incl. Cap Savings (Rest-Of-Season)',
        column_groups: [
          COLUMN_GROUPS.PROJECTION,
          COLUMN_GROUPS.REST_OF_SEASON_PROJECTION,
          COLUMN_GROUPS.FANTASY_LEAGUE
        ],
        header_label: 'Value',
        player_value_path:
          'rest_of_season_points_added_positive_including_cap_savings',
        size: 70,
        data_type: table_constants.TABLE_DATA_TYPES.NUMBER
      }
  }

  if (!is_logged_in) {
    Object.keys(fields).forEach((key) => {
      fields[key].hidden = true
    })
  }

  return fields
}
