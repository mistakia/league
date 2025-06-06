import React from 'react'

import PlayerRowNameColumn from '@components/player-row-name-column'
import PlayerRowNFLTeam from '@components/player-row-nfl-team'
import PlayerRowPositionColumn from '@components/player-row-position-column'
import COLUMN_GROUPS from './column-groups'
import * as table_constants from 'react-table/src/constants.mjs'
import { constants } from '@libs-shared'

const contract_field = (props) => ({
  ...props,
  size: 80,
  data_type: table_constants.TABLE_DATA_TYPES.NUMBER,
  column_groups: [COLUMN_GROUPS.PLAYER_CONTRACT]
})

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
      column_values: ['TEAM', ...constants.positions],
      player_value_path: 'pos',
      component: React.memo(PlayerRowPositionColumn),
      operators: [
        table_constants.TABLE_OPERATORS.IN,
        table_constants.TABLE_OPERATORS.NOT_IN
      ]
    },
    player_nfl_teams: {
      column_title: 'Player NFL Teams',
      header_label: 'Teams',
      size: 70,
      data_type: table_constants.TABLE_DATA_TYPES.SELECT,
      player_value_path: 'player_nfl_teams',
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
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER,
      reverse_percentiles: true
    },
    player_forty_yard_dash: {
      column_title: '40 Yard Dash',
      header_label: 'Forty',
      size: 60,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER,
      column_groups: [COLUMN_GROUPS.MEASURABLES],
      player_value_path: 'forty',
      reverse_percentiles: true
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
      player_value_path: 'shuttle',
      reverse_percentiles: true
    },
    player_three_cone_drill: {
      column_title: 'Three Cone Drill',
      header_label: '3 Cone',
      size: 60,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER,
      column_groups: [COLUMN_GROUPS.MEASURABLES],
      player_value_path: 'cone',
      reverse_percentiles: true
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
      player_value_path: 'dpos',
      reverse_percentiles: true
    },
    player_draft_round: {
      column_title: 'Draft Round',
      header_label: 'Rd',
      size: 50,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER,
      column_groups: [COLUMN_GROUPS.DRAFT],
      player_value_path: 'round',
      reverse_percentiles: true
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
      player_value_path: 'nfl_draft_year'
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

    player_nfl_id: {
      column_title: 'NFL Player ID',
      header_label: 'NFL ID',
      size: 80,
      data_type: table_constants.TABLE_DATA_TYPES.TEXT,
      player_value_path: 'nfl_id',
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
      column_groups: [COLUMN_GROUPS.PLAYER_IDS, COLUMN_GROUPS.ESPN]
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
    },
    player_otc_id: {
      column_title: 'Over The Cap Player ID',
      header_label: 'OTC ID',
      size: 80,
      data_type: table_constants.TABLE_DATA_TYPES.TEXT,
      player_value_path: 'otc_id',
      column_groups: [COLUMN_GROUPS.PLAYER_IDS]
    },
    player_draftkings_id: {
      column_title: 'DraftKings Player ID',
      header_label: 'DraftKings ID',
      size: 80,
      data_type: table_constants.TABLE_DATA_TYPES.TEXT,
      player_value_path: 'draftkings_id',
      column_groups: [COLUMN_GROUPS.PLAYER_IDS]
    },
    player_pff_id: {
      column_title: 'PFF Player ID',
      header_label: 'PFF ID',
      size: 80,
      data_type: table_constants.TABLE_DATA_TYPES.TEXT,
      player_value_path: 'pff_id',
      column_groups: [COLUMN_GROUPS.PLAYER_IDS, COLUMN_GROUPS.PFF]
    },
    player_mfl_id: {
      column_title: 'MFL Player ID',
      header_label: 'MFL ID',
      size: 80,
      data_type: table_constants.TABLE_DATA_TYPES.TEXT,
      player_value_path: 'mfl_id',
      column_groups: [COLUMN_GROUPS.PLAYER_IDS]
    },
    player_fleaflicker_id: {
      column_title: 'Fleaflicker Player ID',
      header_label: 'Fleaflicker ID',
      size: 80,
      data_type: table_constants.TABLE_DATA_TYPES.TEXT,
      player_value_path: 'fleaflicker_id',
      column_groups: [COLUMN_GROUPS.PLAYER_IDS]
    },
    player_cbs_id: {
      column_title: 'CBS Player ID',
      header_label: 'CBS ID',
      size: 80,
      data_type: table_constants.TABLE_DATA_TYPES.TEXT,
      player_value_path: 'cbs_id',
      column_groups: [COLUMN_GROUPS.PLAYER_IDS]
    },
    player_cfbref_id: {
      column_title: 'CFB Reference Player ID',
      header_label: 'CFBRef ID',
      size: 80,
      data_type: table_constants.TABLE_DATA_TYPES.TEXT,
      player_value_path: 'cfbref_id',
      column_groups: [COLUMN_GROUPS.PLAYER_IDS]
    },
    player_twitter_username: {
      column_title: 'Twitter Username',
      header_label: 'Twitter',
      size: 80,
      data_type: table_constants.TABLE_DATA_TYPES.TEXT,
      player_value_path: 'twitter_username',
      column_groups: [COLUMN_GROUPS.PLAYER_IDS]
    },
    player_swish_id: {
      column_title: 'Swish Player ID',
      header_label: 'Swish ID',
      size: 80,
      data_type: table_constants.TABLE_DATA_TYPES.TEXT,
      player_value_path: 'swish_id',
      column_groups: [COLUMN_GROUPS.PLAYER_IDS]
    },
    player_rts_id: {
      column_title: 'RTS Player ID',
      header_label: 'RTS ID',
      size: 80,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER,
      player_value_path: 'rts_id',
      column_groups: [COLUMN_GROUPS.PLAYER_IDS]
    },
    player_fanduel_id: {
      column_title: 'FanDuel Player ID',
      header_label: 'FanDuel ID',
      size: 80,
      data_type: table_constants.TABLE_DATA_TYPES.TEXT,
      player_value_path: 'fanduel_id',
      column_groups: [COLUMN_GROUPS.PLAYER_IDS]
    },

    player_contract_year_signed: contract_field({
      column_title: 'Contract Year Signed (Current)',
      header_label: 'Signed',
      player_value_path: 'contract_year_signed'
    }),
    player_contract_years: contract_field({
      column_title: 'Contract Years Total (Current)',
      header_label: 'Years',
      player_value_path: 'contract_years'
    }),
    player_contract_value: contract_field({
      column_title: 'Contract Value (Current)',
      header_label: 'Value',
      player_value_path: 'contract_value'
    }),
    player_contract_apy: contract_field({
      column_title: 'Contract APY (Current)',
      header_label: 'APY',
      player_value_path: 'contract_apy'
    }),
    player_contract_guaranteed: contract_field({
      column_title: 'Contract Guaranteed (Current)',
      header_label: 'Gtd',
      player_value_path: 'contract_guaranteed'
    }),
    player_contract_apy_cap_pct: contract_field({
      column_title: 'Contract APY Cap % (Current)',
      header_label: 'APY Cap %',
      player_value_path: 'contract_apy_cap_pct'
    }),
    player_contract_inflated_value: contract_field({
      column_title: 'Contract Inflated Value (Current)',
      header_label: 'Inflated Value',
      player_value_path: 'contract_inflated_value'
    }),
    player_contract_inflated_apy: contract_field({
      column_title: 'Contract Inflated APY (Current)',
      header_label: 'Inflated APY',
      player_value_path: 'contract_inflated_apy'
    }),
    player_contract_inflated_guaranteed: contract_field({
      column_title: 'Contract Inflated Guaranteed (Current)',
      header_label: 'Inflated Gtd',
      player_value_path: 'contract_inflated_guaranteed'
    }),

    player_pfr_weighted_career_approximate_value: {
      column_title: 'PFR Weighted Career Approximate Value',
      header_label: 'PFR AV (Career)',
      size: 80,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER,
      player_value_path: 'pfr_weighted_career_approximate_value',
      column_groups: [COLUMN_GROUPS.PFR, COLUMN_GROUPS.CAREER]
    },
    player_pfr_weighted_career_approximate_value_drafted_team: {
      column_title: 'PFR Weighted Career Approximate Value with Drafted Team',
      header_label: 'PFR AV (Drafted Team)',
      size: 80,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER,
      player_value_path: 'pfr_weighted_career_approximate_value_drafted_team',
      column_groups: [COLUMN_GROUPS.PFR, COLUMN_GROUPS.CAREER]
    },
    player_pfr_years_as_primary_starter: {
      column_title: 'PFR Years as Primary Starter',
      header_label: 'Yrs Start',
      size: 80,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER,
      player_value_path: 'pfr_years_as_primary_starter',
      column_groups: [COLUMN_GROUPS.PFR, COLUMN_GROUPS.CAREER]
    },
    player_all_pro_first_team_selections: {
      column_title: 'All-Pro First Team Selections',
      header_label: 'AP1',
      size: 80,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER,
      player_value_path: 'all_pro_first_team_selections',
      column_groups: [COLUMN_GROUPS.CAREER]
    },
    player_pro_bowl_selections: {
      column_title: 'Pro Bowl Selections',
      header_label: 'PBs',
      size: 80,
      data_type: table_constants.TABLE_DATA_TYPES.NUMBER,
      player_value_path: 'pro_bowl_selections',
      column_groups: [COLUMN_GROUPS.CAREER]
    }
  }
}
