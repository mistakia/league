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
      column_groups: [COLUMN_GROUPS.MEASURABLES],
      player_value_path: 'height'
    },
    player_weight: {
      column_title: 'Weight',
      header_label: 'Lbs',
      size: 50,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER,
      column_groups: [COLUMN_GROUPS.MEASURABLES],
      player_value_path: 'weight'
    },
    player_body_mass_index: {
      column_title: 'Body Mass Index',
      header_label: 'BMI',
      size: 60,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER,
      column_groups: [COLUMN_GROUPS.MEASURABLES],
      player_value_path: 'bmi'
    },
    player_speed_score: {
      column_title: 'Speed Score',
      header_label: 'Speed Score',
      size: 60,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER,
      column_groups: [COLUMN_GROUPS.MEASURABLES],
      player_value_path: 'speed_score'
    },
    player_height_adjusted_speed_score: {
      column_title: 'Height Adjusted Speed Score',
      header_label: 'Adj Speed Score',
      size: 60,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER,
      column_groups: [COLUMN_GROUPS.MEASURABLES],
      player_value_path: 'height_adjusted_speed_score'
    },
    player_agility_score: {
      column_title: 'Agility Score',
      header_label: 'Agility Score',
      size: 60,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER,
      column_groups: [COLUMN_GROUPS.MEASURABLES],
      player_value_path: 'agility_score'
    },
    player_burst_score: {
      column_title: 'Burst Score',
      header_label: 'Burst Score',
      size: 60,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER,
      column_groups: [COLUMN_GROUPS.MEASURABLES],
      player_value_path: 'burst_score'
    },
    player_date_of_birth: {
      column_title: 'Date of Birth',
      header_label: 'DOB',
      size: 110,
      data_type: table_constants.TABLE_DATA_TYPES.DATE,
      player_value_path: 'dob'
    },
    player_age: {
      column_title: 'Age',
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
    },
    player_ngs_athleticism_score: {
      column_title: 'NGS Prospect Athleticism Score',
      header_label: 'Ath',
      size: 80,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER,
      player_value_path: 'ngs_athleticism_score',
      column_groups: [COLUMN_GROUPS.PROSPECT, COLUMN_GROUPS.NGS]
    },
    player_ngs_draft_grade: {
      column_title: 'NGS Prospect Draft Grade',
      header_label: 'Grade',
      size: 80,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER,
      player_value_path: 'ngs_draft_grade',
      column_groups: [COLUMN_GROUPS.PROSPECT, COLUMN_GROUPS.NGS]
    },
    player_nfl_grade: {
      column_title: 'NFL Prospect Grade',
      header_label: 'Grade',
      size: 80,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER,
      player_value_path: 'nfl_grade',
      column_groups: [COLUMN_GROUPS.PROSPECT, COLUMN_GROUPS.NFL]
    },
    player_ngs_production_score: {
      column_title: 'NGS Prospect Production Score',
      header_label: 'Prod',
      size: 80,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER,
      player_value_path: 'ngs_production_score',
      column_groups: [COLUMN_GROUPS.PROSPECT, COLUMN_GROUPS.NGS]
    },
    player_ngs_size_score: {
      column_title: 'NGS Prospect Size Score',
      header_label: 'Size',
      size: 80,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER,
      player_value_path: 'ngs_size_score',
      column_groups: [COLUMN_GROUPS.PROSPECT, COLUMN_GROUPS.NGS]
    },

    player_nflid: {
      column_title: 'NFL Player ID',
      header_label: 'NFL ID',
      size: 80,
      data_type: table_constants.TABLE_DATA_TYPES.TEXT,
      player_value_path: 'nflid',
      column_groups: [COLUMN_GROUPS.PLAYER_IDS]
    },
    player_esbid: {
      column_title: 'Elias Sports Bureau Player ID',
      header_label: 'ESB ID',
      size: 80,
      data_type: table_constants.TABLE_DATA_TYPES.TEXT,
      player_value_path: 'esbid',
      column_groups: [COLUMN_GROUPS.PLAYER_IDS]
    },
    player_gsisid: {
      column_title: 'Game Statistics & Information System Player ID (gsis)',
      header_label: 'GSIS ID',
      size: 80,
      data_type: table_constants.TABLE_DATA_TYPES.TEXT,
      player_value_path: 'gsisid',
      column_groups: [COLUMN_GROUPS.PLAYER_IDS]
    },
    player_gsispid: {
      column_title: 'Game Statistics & Information System Player ID (gsispid)',
      header_label: 'GSIS PID',
      size: 80,
      data_type: table_constants.TABLE_DATA_TYPES.TEXT,
      player_value_path: 'gsispid',
      column_groups: [COLUMN_GROUPS.PLAYER_IDS]
    },
    player_gsis_it_id: {
      column_title: 'Game Statistics & Information System Player ID (gsis_it)',
      header_label: 'GSIS IT ID',
      size: 80,
      data_type: table_constants.TABLE_DATA_TYPES.TEXT,
      player_value_path: 'gsis_it_id',
      column_groups: [COLUMN_GROUPS.PLAYER_IDS]
    },
    player_sleeper_id: {
      column_title: 'Sleeper Player ID',
      header_label: 'Sleeper ID',
      size: 80,
      data_type: table_constants.TABLE_DATA_TYPES.TEXT,
      player_value_path: 'sleeper_id',
      column_groups: [COLUMN_GROUPS.PLAYER_IDS]
    },
    player_rotoworld_id: {
      column_title: 'Rotoworld Player ID',
      header_label: 'Rotoworld ID',
      size: 80,
      data_type: table_constants.TABLE_DATA_TYPES.TEXT,
      player_value_path: 'rotoworld_id',
      column_groups: [COLUMN_GROUPS.PLAYER_IDS]
    },
    player_rotowire_id: {
      column_title: 'Rotowire Player ID',
      header_label: 'Rotowire ID',
      size: 80,
      data_type: table_constants.TABLE_DATA_TYPES.TEXT,
      player_value_path: 'rotowire_id',
      column_groups: [COLUMN_GROUPS.PLAYER_IDS]
    },
    player_sportradar_id: {
      column_title: 'Sportradar Player ID',
      header_label: 'Sportradar ID',
      size: 80,
      data_type: table_constants.TABLE_DATA_TYPES.TEXT,
      player_value_path: 'sportradar_id',
      column_groups: [COLUMN_GROUPS.PLAYER_IDS]
    },
    player_espn_id: {
      column_title: 'ESPN Player ID',
      header_label: 'ESPN ID',
      size: 80,
      data_type: table_constants.TABLE_DATA_TYPES.TEXT,
      player_value_path: 'espn_id',
      column_groups: [COLUMN_GROUPS.PLAYER_IDS]
    },
    player_fantasy_data_id: {
      column_title: 'Fantasy Data Player ID',
      header_label: 'Fantasy Data ID',
      size: 80,
      data_type: table_constants.TABLE_DATA_TYPES.TEXT,
      player_value_path: 'fantasy_data_id',
      column_groups: [COLUMN_GROUPS.PLAYER_IDS]
    },
    player_yahoo_id: {
      column_title: 'Yahoo Player ID',
      header_label: 'Yahoo ID',
      size: 80,
      data_type: table_constants.TABLE_DATA_TYPES.TEXT,
      player_value_path: 'yahoo_id',
      column_groups: [COLUMN_GROUPS.PLAYER_IDS]
    },
    player_keeptradecut_id: {
      column_title: 'KeepTradeCut Player ID',
      header_label: 'KTC ID',
      size: 80,
      data_type: table_constants.TABLE_DATA_TYPES.TEXT,
      player_value_path: 'keeptradecut_id',
      column_groups: [COLUMN_GROUPS.PLAYER_IDS]
    },
    player_pfr_id: {
      column_title: 'Pro Football Reference Player ID',
      header_label: 'PFR ID',
      size: 80,
      data_type: table_constants.TABLE_DATA_TYPES.TEXT,
      player_value_path: 'pfr_id',
      column_groups: [COLUMN_GROUPS.PLAYER_IDS]
    }
  }
}
