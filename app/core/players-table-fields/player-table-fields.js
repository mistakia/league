import React from 'react'

import PlayerRowNameColumn from '@components/player-row-name-column'
import PlayerRowNFLTeam from '@components/player-row-nfl-team'
import COLUMN_GROUPS from './column-groups'
import * as table_constants from 'react-table/src/constants.mjs'
import { constants } from '@libs-shared'

export default function ({ is_logged_in }) {
  return {
    player_name: {
      column_title: 'Full Name',
      header_label: 'Name',
      size:
        (window.innerWidth >= 601
          ? 200
          : window.innerWidth <= 400
            ? 100
            : 150) + (is_logged_in ? 30 : 0),
      component: React.memo(PlayerRowNameColumn),
      data_type: table_constants.TABLE_DATA_TYPES.TEXT,
      player_value_path: 'name',
      sticky: true,
      accessorFn: ({ row }) => `${row.fname} ${row.lname}`
    },
    player_position: {
      column_title: 'Position',
      header_label: 'Pos',
      size: 50,
      data_type: table_constants.TABLE_DATA_TYPES.SELECT,
      column_values: constants.positions,
      player_value_path: 'pos',
      operators: [
        table_constants.TABLE_OPERATORS.IN,
        table_constants.TABLE_OPERATORS.NOT_IN
      ]
    },
    player_height: {
      column_title: 'Height',
      header_label: 'IN"',
      size: 50,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER,
      player_value_path: 'height'
    },
    player_weight: {
      column_title: 'Weight',
      header_label: 'Lbs',
      size: 50,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER,
      player_value_path: 'weight'
    },
    player_date_of_birth: {
      column_title: 'Date of Birth',
      header_label: 'DOB',
      size: 110,
      data_type: table_constants.TABLE_DATA_TYPES.DATE,
      player_value_path: 'dob'
    },
    player_age: {
      column_title: 'Current Age',
      header_label: 'Age',
      player_value_path: 'age',
      size: 60,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER
    },
    player_forty_yard_dash: {
      column_title: '40 Yard Dash',
      header_label: 'Forty',
      size: 60,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER,
      column_groups: [COLUMN_GROUPS.MEASURABLES],
      player_value_path: 'forty'
    },
    player_bench_press: {
      column_title: 'Bench Press',
      header_label: 'Bench',
      size: 50,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER,
      column_groups: [COLUMN_GROUPS.MEASURABLES],
      player_value_path: 'bench'
    },
    player_vertical_jump: {
      column_title: 'Vertical Jump',
      header_label: 'Vert',
      size: 60,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER,
      column_groups: [COLUMN_GROUPS.MEASURABLES],
      player_value_path: 'vertical'
    },
    player_broad_jump: {
      column_title: 'Broad Jump',
      header_label: 'Broad',
      size: 50,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER,
      column_groups: [COLUMN_GROUPS.MEASURABLES],
      player_value_path: 'broad'
    },
    player_shuttle_run: {
      column_title: 'Shuttle Run',
      header_label: 'Shuttle',
      size: 60,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER,
      column_groups: [COLUMN_GROUPS.MEASURABLES],
      player_value_path: 'shuttle'
    },
    player_three_cone_drill: {
      column_title: 'Three Cone Drill',
      header_label: '3 Cone',
      size: 60,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER,
      column_groups: [COLUMN_GROUPS.MEASURABLES],
      player_value_path: 'cone'
    },
    player_arm_length: {
      column_title: 'Arm Length',
      header_label: 'Arm',
      size: 60,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER,
      column_groups: [COLUMN_GROUPS.MEASURABLES],
      player_value_path: 'arm'
    },
    player_hand_size: {
      column_title: 'Hand Size',
      header_label: 'Hand',
      size: 60,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER,
      column_groups: [COLUMN_GROUPS.MEASURABLES],
      player_value_path: 'hand'
    },
    player_draft_position: {
      column_title: 'Draft Position',
      header_label: 'Pos',
      size: 50,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER,
      column_groups: [COLUMN_GROUPS.DRAFT],
      player_value_path: 'dpos'
    },
    player_draft_round: {
      column_title: 'Draft Round',
      header_label: 'Rd',
      size: 50,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER,
      column_groups: [COLUMN_GROUPS.DRAFT],
      player_value_path: 'round'
    },
    player_college: {
      column_title: 'College',
      header_label: 'College',
      size: 150,
      data_type: table_constants.TABLE_DATA_TYPES.TEXT,
      column_groups: [COLUMN_GROUPS.COLLEGE],
      player_value_path: 'col'
    },
    player_college_division: {
      column_title: 'College Division',
      header_label: 'Div',
      size: 140,
      data_type: table_constants.TABLE_DATA_TYPES.TEXT,
      column_groups: [COLUMN_GROUPS.COLLEGE],
      player_value_path: 'dv'
    },
    player_starting_nfl_year: {
      column_title: 'Starting NFL Year',
      header_label: 'Year',
      size: 60,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER,
      column_groups: [COLUMN_GROUPS.DRAFT],
      player_value_path: 'start'
    },
    player_current_nfl_team: {
      column_title: 'Current NFL Team',
      header_label: 'Team',
      size: 60,
      data_type: table_constants.TABLE_DATA_TYPES.SELECT,
      player_value_path: 'team',
      component: React.memo(PlayerRowNFLTeam),
      column_groups: [COLUMN_GROUPS.NFL_TEAM],
      operators: [
        table_constants.TABLE_OPERATORS.IN,
        table_constants.TABLE_OPERATORS.NOT_IN,
        table_constants.TABLE_OPERATORS.IS_NULL,
        table_constants.TABLE_OPERATORS.IS_NOT_NULL
      ],
      column_values: ['INA', ...constants.nflTeams]
    },
    player_position_depth: {
      column_title: 'Position Depth',
      header_label: 'Pos Depth',
      size: 50,
      data_type: table_constants.TABLE_DATA_TYPES.TEXT,
      player_value_path: 'posd',
      column_groups: [COLUMN_GROUPS.NFL_TEAM]
    },
    player_jersey_number: {
      column_title: 'Jersey Number',
      header_label: 'No.',
      size: 50,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER,
      player_value_path: 'jnum',
      column_groups: [COLUMN_GROUPS.NFL_TEAM]
    }
  }
}
