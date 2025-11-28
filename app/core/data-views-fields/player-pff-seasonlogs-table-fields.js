import { common_column_params } from '@libs-shared'
import COLUMN_GROUPS from './column-groups'
import * as table_constants from 'react-table/src/constants.mjs'
import { current_season } from '@constants'

const { single_year } = common_column_params

const pff_seasonlog_field = (props) => ({
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
    }
  }
})

export default function ({ is_logged_in }) {
  const fields = {
    player_pff_fg_ep_kicker: pff_seasonlog_field({
      column_title: 'PFF FG/EP Kicker',
      header_label: 'FG EP',
      player_value_path: 'pff_fg_ep_kicker'
    }),
    player_pff_defense_rank: pff_seasonlog_field({
      column_title: 'PFF Defense Rank',
      header_label: 'Def Rank',
      player_value_path: 'pff_defense_rank',
      reverse_percentiles: true
    }),
    player_pff_grade_position: pff_seasonlog_field({
      column_title: 'PFF Grade Position',
      header_label: 'Grade Pos',
      player_value_path: 'pff_grade_position',
      data_type: table_constants.TABLE_DATA_TYPES.TEXT
    }),
    player_pff_run_block: pff_seasonlog_field({
      column_title: 'PFF Run Block Grade',
      header_label: 'Run Block',
      player_value_path: 'pff_run_block'
    }),
    player_pff_offense: pff_seasonlog_field({
      column_title: 'PFF Offense Grade',
      header_label: 'Offense',
      player_value_path: 'pff_offense'
    }),
    player_pff_special_teams: pff_seasonlog_field({
      column_title: 'PFF Special Teams Grade',
      header_label: 'ST',
      player_value_path: 'pff_special_teams'
    }),
    player_pff_offense_snaps: pff_seasonlog_field({
      column_title: 'PFF Offense Snaps',
      header_label: 'Off Snaps',
      player_value_path: 'pff_offense_snaps'
    }),
    player_pff_special_teams_snaps: pff_seasonlog_field({
      column_title: 'PFF Special Teams Snaps',
      header_label: 'ST Snaps',
      player_value_path: 'pff_special_teams_snaps'
    }),
    player_pff_coverage_snaps: pff_seasonlog_field({
      column_title: 'PFF Coverage Snaps',
      header_label: 'Cov Snaps',
      player_value_path: 'pff_coverage_snaps'
    }),
    player_pff_punter_rank: pff_seasonlog_field({
      column_title: 'PFF Punter Rank',
      header_label: 'Punt Rank',
      player_value_path: 'pff_punter_rank',
      reverse_percentiles: true
    }),
    player_pff_pass_rush: pff_seasonlog_field({
      column_title: 'PFF Pass Rush Grade',
      header_label: 'Pass Rush',
      player_value_path: 'pff_pass_rush'
    }),
    player_pff_punter: pff_seasonlog_field({
      column_title: 'PFF Punter Grade',
      header_label: 'Punter',
      player_value_path: 'pff_punter'
    }),
    player_pff_pass_block: pff_seasonlog_field({
      column_title: 'PFF Pass Block Grade',
      header_label: 'Pass Block',
      player_value_path: 'pff_pass_block'
    }),
    player_pff_run_block_snaps: pff_seasonlog_field({
      column_title: 'PFF Run Block Snaps',
      header_label: 'Run Block Snaps',
      player_value_path: 'pff_run_block_snaps'
    }),
    player_pff_offense_ranked: pff_seasonlog_field({
      column_title: 'PFF Offense Ranked',
      header_label: 'Off Ranked',
      player_value_path: 'pff_offense_ranked',
      reverse_percentiles: true
    }),
    player_pff_defense_snaps: pff_seasonlog_field({
      column_title: 'PFF Defense Snaps',
      header_label: 'Def Snaps',
      player_value_path: 'pff_defense_snaps'
    }),
    player_pff_pass_snaps: pff_seasonlog_field({
      column_title: 'PFF Pass Snaps',
      header_label: 'Pass Snaps',
      player_value_path: 'pff_pass_snaps'
    }),
    player_pff_defense: pff_seasonlog_field({
      column_title: 'PFF Defense Grade',
      header_label: 'Defense',
      player_value_path: 'pff_defense'
    }),
    player_pff_receiving: pff_seasonlog_field({
      column_title: 'PFF Receiving Grade',
      header_label: 'Receiving',
      player_value_path: 'pff_receiving'
    }),
    player_pff_coverage: pff_seasonlog_field({
      column_title: 'PFF Coverage Grade',
      header_label: 'Coverage',
      player_value_path: 'pff_coverage'
    }),
    player_pff_run: pff_seasonlog_field({
      column_title: 'PFF Run Grade',
      header_label: 'Run',
      player_value_path: 'pff_run'
    }),
    player_pff_run_defense_snaps: pff_seasonlog_field({
      column_title: 'PFF Run Defense Snaps',
      header_label: 'Run Def Snaps',
      player_value_path: 'pff_run_defense_snaps'
    }),
    player_pff_defense_ranked: pff_seasonlog_field({
      column_title: 'PFF Defense Ranked',
      header_label: 'Def Ranked',
      player_value_path: 'pff_defense_ranked',
      reverse_percentiles: true
    }),
    player_pff_pass_rush_snaps: pff_seasonlog_field({
      column_title: 'PFF Pass Rush Snaps',
      header_label: 'Pass Rush Snaps',
      player_value_path: 'pff_pass_rush_snaps'
    }),
    player_pff_pass_block_snaps: pff_seasonlog_field({
      column_title: 'PFF Pass Block Snaps',
      header_label: 'Pass Block Snaps',
      player_value_path: 'pff_pass_block_snaps'
    }),
    player_pff_run_defense: pff_seasonlog_field({
      column_title: 'PFF Run Defense Grade',
      header_label: 'Run Defense',
      player_value_path: 'pff_run_defense'
    }),
    player_pff_special_teams_rank: pff_seasonlog_field({
      column_title: 'PFF Special Teams Rank',
      header_label: 'ST Rank',
      player_value_path: 'pff_special_teams_rank',
      reverse_percentiles: true
    }),
    player_pff_run_snaps: pff_seasonlog_field({
      column_title: 'PFF Run Snaps',
      header_label: 'Run Snaps',
      player_value_path: 'pff_run_snaps'
    }),
    player_pff_kickoff_kicker: pff_seasonlog_field({
      column_title: 'PFF Kickoff Kicker Grade',
      header_label: 'KO Kicker',
      player_value_path: 'pff_kickoff_kicker'
    }),
    player_pff_pass: pff_seasonlog_field({
      column_title: 'PFF Pass Grade',
      header_label: 'Pass',
      player_value_path: 'pff_pass'
    }),
    player_pff_receiving_snaps: pff_seasonlog_field({
      column_title: 'PFF Receiving Snaps',
      header_label: 'Rec Snaps',
      player_value_path: 'pff_receiving_snaps'
    }),
    player_pff_overall_snaps: pff_seasonlog_field({
      column_title: 'PFF Overall Snaps',
      header_label: 'Total Snaps',
      player_value_path: 'pff_overall_snaps'
    }),
    player_pff_offense_rank: pff_seasonlog_field({
      column_title: 'PFF Offense Rank',
      header_label: 'Off Rank',
      player_value_path: 'pff_offense_rank',
      reverse_percentiles: true
    })
  }

  if (!is_logged_in) {
    Object.keys(fields).forEach((key) => {
      fields[key].hidden = true
    })
  }

  return fields
}
