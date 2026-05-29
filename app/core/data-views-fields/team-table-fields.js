import COLUMN_GROUPS from './column-groups'
import * as table_constants from 'react-table/src/constants.mjs'
import { build_nfl_team_values, nfl_team_value_groups } from '@constants'

const team_code_column_values = build_nfl_team_values()

export default {
  team_code: {
    column_title: 'Team',
    header_label: 'Team',
    size: 60,
    data_type: table_constants.TABLE_DATA_TYPES.SELECT,
    player_value_path: 'team_code',
    column_groups: [COLUMN_GROUPS.NFL_TEAM],
    sticky: true,
    column_values: team_code_column_values,
    column_value_groups: nfl_team_value_groups,
    operators: [
      table_constants.TABLE_OPERATORS.IN,
      table_constants.TABLE_OPERATORS.NOT_IN
    ]
  },
  team_name: {
    column_title: 'Team Name',
    header_label: 'Name',
    size: 160,
    data_type: table_constants.TABLE_DATA_TYPES.TEXT,
    player_value_path: 'team_name',
    column_groups: [COLUMN_GROUPS.NFL_TEAM]
  },
  team_conference: {
    column_title: 'Conference',
    header_label: 'Conf',
    size: 60,
    data_type: table_constants.TABLE_DATA_TYPES.SELECT,
    player_value_path: 'team_conference',
    column_groups: [COLUMN_GROUPS.NFL_TEAM],
    column_values: [
      { value: 'AFC', label: 'AFC', group: null },
      { value: 'NFC', label: 'NFC', group: null }
    ],
    operators: [
      table_constants.TABLE_OPERATORS.IN,
      table_constants.TABLE_OPERATORS.NOT_IN
    ]
  },
  team_division: {
    column_title: 'Division',
    header_label: 'Div',
    size: 80,
    data_type: table_constants.TABLE_DATA_TYPES.SELECT,
    player_value_path: 'team_division',
    column_groups: [COLUMN_GROUPS.NFL_TEAM],
    column_values: [
      { value: 'AFC East', label: 'AFC East', group: 'AFC' },
      { value: 'AFC North', label: 'AFC North', group: 'AFC' },
      { value: 'AFC South', label: 'AFC South', group: 'AFC' },
      { value: 'AFC West', label: 'AFC West', group: 'AFC' },
      { value: 'NFC East', label: 'NFC East', group: 'NFC' },
      { value: 'NFC North', label: 'NFC North', group: 'NFC' },
      { value: 'NFC South', label: 'NFC South', group: 'NFC' },
      { value: 'NFC West', label: 'NFC West', group: 'NFC' }
    ],
    operators: [
      table_constants.TABLE_OPERATORS.IN,
      table_constants.TABLE_OPERATORS.NOT_IN
    ]
  }
}
