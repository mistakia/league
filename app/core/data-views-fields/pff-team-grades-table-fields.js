import {
  common_column_params,
  nfl_plays_team_column_params
} from '@libs-shared'
import COLUMN_GROUPS from './column-groups'
import * as table_constants from 'react-table/src/constants.mjs'
import { current_season } from '@constants'

const { single_year } = common_column_params
const { matchup_opponent_type } = nfl_plays_team_column_params

const pff_team_field = (props) => ({
  ...props,
  column_groups: [COLUMN_GROUPS.PFF],
  size: 70,
  data_type: table_constants.TABLE_DATA_TYPES.NUMBER,
  column_params: {
    year: {
      ...single_year,
      values: [...Array(current_season.year - 2006).keys()].map(
        (i) => current_season.year - i
      )
    },
    matchup_opponent_type
  },
  splits: ['year']
})

export default {
  // PFF Grade columns
  pff_team_grades_offense: pff_team_field({
    column_title: 'PFF Team Offense Grade',
    header_label: 'Offense',
    player_value_path: 'pff_team_grades_offense'
  }),
  pff_team_grades_defense: pff_team_field({
    column_title: 'PFF Team Defense Grade',
    header_label: 'Defense',
    player_value_path: 'pff_team_grades_defense'
  }),
  pff_team_grades_special_teams: pff_team_field({
    column_title: 'PFF Team Special Teams Grade',
    header_label: 'Special Teams',
    player_value_path: 'pff_team_grades_special_teams'
  }),
  pff_team_grades_overall: pff_team_field({
    column_title: 'PFF Team Overall Grade',
    header_label: 'Overall',
    player_value_path: 'pff_team_grades_overall'
  }),
  pff_team_grades_pass: pff_team_field({
    column_title: 'PFF Team Pass Grade',
    header_label: 'Pass',
    player_value_path: 'pff_team_grades_pass'
  }),
  pff_team_grades_run: pff_team_field({
    column_title: 'PFF Team Run Grade',
    header_label: 'Run',
    player_value_path: 'pff_team_grades_run'
  }),
  pff_team_grades_pass_block: pff_team_field({
    column_title: 'PFF Team Pass Block Grade',
    header_label: 'Pass Block',
    player_value_path: 'pff_team_grades_pass_block'
  }),
  pff_team_grades_pass_rush_defense: pff_team_field({
    column_title: 'PFF Team Pass Rush Defense Grade',
    header_label: 'Pass Rush Def',
    player_value_path: 'pff_team_grades_pass_rush_defense'
  }),
  pff_team_grades_run_defense: pff_team_field({
    column_title: 'PFF Team Run Defense Grade',
    header_label: 'Run Defense',
    player_value_path: 'pff_team_grades_run_defense'
  }),
  pff_team_grades_run_block: pff_team_field({
    column_title: 'PFF Team Run Block Grade',
    header_label: 'Run Block',
    player_value_path: 'pff_team_grades_run_block'
  }),
  pff_team_grades_coverage_defense: pff_team_field({
    column_title: 'PFF Team Coverage Defense Grade',
    header_label: 'Coverage Def',
    player_value_path: 'pff_team_grades_coverage_defense'
  }),
  pff_team_grades_tackle: pff_team_field({
    column_title: 'PFF Team Tackle Grade',
    header_label: 'Tackle',
    player_value_path: 'pff_team_grades_tackle'
  }),
  pff_team_grades_pass_route: pff_team_field({
    column_title: 'PFF Team Pass Route Grade',
    header_label: 'Pass Route',
    player_value_path: 'pff_team_grades_pass_route'
  }),

  // Team record and scoring stats
  pff_team_wins: pff_team_field({
    column_title: 'PFF Team Wins',
    header_label: 'Wins',
    player_value_path: 'pff_team_wins'
  }),
  pff_team_losses: pff_team_field({
    column_title: 'PFF Team Losses',
    header_label: 'Losses',
    player_value_path: 'pff_team_losses'
  }),
  pff_team_ties: pff_team_field({
    column_title: 'PFF Team Ties',
    header_label: 'Ties',
    player_value_path: 'pff_team_ties'
  }),
  pff_team_points_scored: pff_team_field({
    column_title: 'PFF Team Points Scored',
    header_label: 'Points For',
    player_value_path: 'pff_team_points_scored'
  }),
  pff_team_points_allowed: pff_team_field({
    column_title: 'PFF Team Points Allowed',
    header_label: 'Points Against',
    player_value_path: 'pff_team_points_allowed'
  })
}
