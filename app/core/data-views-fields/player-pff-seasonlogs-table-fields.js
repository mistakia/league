import { common_column_params } from '@libs-shared'
import COLUMN_GROUPS from './column-groups'
import * as table_constants from 'react-table/src/constants.mjs'
import { current_season } from '@constants'

const { single_year, career_year, pff_seas_type } = common_column_params

// `is_season_type_scoped` mirrors PFF_PLAYER_SEASON_TYPE_SCOPED_COLUMNS in
// libs-server/data-views-column-definitions/player-pff-seasonlogs-column-definitions.mjs.
// Only a column with REG/POST rows behind it gets the selector -- offering it on
// a column that holds PFF's combined value alone would be a filter whose only
// possible answer is a blank cell.
const pff_seasonlog_field = ({ is_season_type_scoped, ...props }) => ({
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
    career_year,
    ...(is_season_type_scoped ? { seas_type: pff_seas_type } : {})
  }
})

export default function ({ is_logged_in }) {
  const fields = {
    player_pff_fg_ep_kicker: pff_seasonlog_field({
      column_title: 'PFF FG/EP Kicker',
      header_label: 'FG EP',
      player_value_path: 'pff_field_goal_extra_point_kicker'
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
      // Column is `run_grade`, so the server emits `pff_run_grade`. This read
      // said `pff_run` and rendered a blank cell for every row.
      player_value_path: 'pff_run_grade'
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
      // Column is `pass_grade`, so the server emits `pff_pass_grade`. Same
      // blank-cell defect as player_pff_run above.
      player_value_path: 'pff_pass_grade'
    }),
    // `player_value_path` tracks the PHYSICAL column, not the column id: the
    // server derives `select_as` as `pff_${column_name}`, so a path that does
    // not match its definition's column name renders a blank cell against valid
    // SQL with every gate green. `player_pff_run` and `player_pff_pass` above
    // were in exactly that state until this cluster repaired them.
    // The six below had a server definition and a description but NO field
    // here, which makes a column queryable over the API, unselectable in the
    // UI, and fatal to any saved view still holding it ("Field not found for
    // column_id"). Same drift the parity spec was written for, in a family it
    // did not cover until this cluster added it.
    player_pff_height: pff_seasonlog_field({
      column_title: 'PFF Height',
      header_label: 'Height',
      player_value_path: 'pff_height'
    }),
    player_pff_weight: pff_seasonlog_field({
      column_title: 'PFF Weight',
      header_label: 'Weight',
      player_value_path: 'pff_weight'
    }),
    player_pff_speed: pff_seasonlog_field({
      column_title: 'PFF Speed Rating',
      header_label: 'Speed',
      player_value_path: 'pff_speed_rating'
    }),
    player_pff_position: pff_seasonlog_field({
      column_title: 'PFF Position',
      header_label: 'Pos',
      player_value_path: 'pff_player_position',
      data_type: table_constants.TABLE_DATA_TYPES.TEXT
    }),
    player_pff_unit: pff_seasonlog_field({
      column_title: 'PFF Unit',
      header_label: 'Unit',
      player_value_path: 'pff_unit',
      data_type: table_constants.TABLE_DATA_TYPES.TEXT
    }),
    player_pff_meets_snap_minimum: pff_seasonlog_field({
      column_title: 'PFF Meets Snap Minimum',
      header_label: 'Snap Min',
      player_value_path: 'pff_is_meeting_snap_minimum',
      data_type: table_constants.TABLE_DATA_TYPES.BOOLEAN
    }),
    player_pff_pass_plays: pff_seasonlog_field({
      column_title: 'PFF Pass Plays',
      header_label: 'Pass Plays',
      player_value_path: 'pff_pass_plays'
    }),
    player_pff_routes: pff_seasonlog_field({
      column_title: 'PFF Routes',
      header_label: 'Routes',
      player_value_path: 'pff_routes',
      is_season_type_scoped: true
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
