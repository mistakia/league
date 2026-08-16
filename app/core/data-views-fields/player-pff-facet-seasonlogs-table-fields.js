import { common_column_params } from '@libs-shared'
import COLUMN_GROUPS from './column-groups'
import * as table_constants from 'react-table/src/constants.mjs'
import { current_season } from '@constants'

const { single_year, career_year } = common_column_params

// The pff_player_facet_seasonlogs column family. Unlike the pff_player_seasonlogs
// family, these fields carry NO player_value_path: the measurements live only on
// the facet table, never on the player object, so the value renders from the
// data-view result and a value path would render a blank cell instead. The
// column id maps one-to-one to a (facet, scalar) in the server definitions.
const pff_facet_seasonlog_field = ({ ...props }) => ({
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
    career_year
  }
})

export default function ({ is_logged_in }) {
  const fields = {
    // OL pass-blocking pressure detail (facet offense/pass_blocking).
    player_pff_pressures_allowed: pff_facet_seasonlog_field({
      column_title: 'PFF Pressures Allowed',
      header_label: 'Press Allowed'
    }),
    player_pff_hurries_allowed: pff_facet_seasonlog_field({
      column_title: 'PFF Hurries Allowed',
      header_label: 'Hurries Allowed'
    }),
    player_pff_hits_allowed: pff_facet_seasonlog_field({
      column_title: 'PFF Hits Allowed',
      header_label: 'Hits Allowed'
    }),
    player_pff_sacks_allowed: pff_facet_seasonlog_field({
      column_title: 'PFF Sacks Allowed',
      header_label: 'Sacks Allowed'
    }),
    player_pff_pass_blocking_efficiency: pff_facet_seasonlog_field({
      column_title: 'PFF Pass Blocking Efficiency',
      header_label: 'PB Efficiency'
    }),
    player_pff_pass_block_percent: pff_facet_seasonlog_field({
      column_title: 'PFF Pass Block Percent',
      header_label: 'PB Percent'
    }),
    player_pff_true_pass_set_snaps: pff_facet_seasonlog_field({
      column_title: 'PFF True Pass Set Snaps',
      header_label: 'TPS Snaps'
    }),
    player_pff_true_pass_set_grade: pff_facet_seasonlog_field({
      column_title: 'PFF True Pass Set Grade',
      header_label: 'TPS Grade'
    }),
    player_pff_true_pass_set_pressures_allowed: pff_facet_seasonlog_field({
      column_title: 'PFF True Pass Set Pressures Allowed',
      header_label: 'TPS Press'
    }),

    // QB pressure rate (facet passing/pressure).
    player_pff_pressure_percentage: pff_facet_seasonlog_field({
      column_title: 'PFF Pressure Percentage',
      header_label: 'Pressure %'
    }),

    // Pocket time (facet signature/passing/time_in_pocket).
    player_pff_time_in_pocket: pff_facet_seasonlog_field({
      column_title: 'PFF Time In Pocket',
      header_label: 'Time In Pocket'
    }),

    // Slot-coverage receiving detail (facet signature/defense/slot_coverage) --
    // targets/receptions/yards/touchdowns allowed in slot coverage.
    player_pff_slot_coverage_targets: pff_facet_seasonlog_field({
      column_title: 'PFF Slot Coverage Targets',
      header_label: 'Slot Targets'
    }),
    player_pff_slot_coverage_receptions: pff_facet_seasonlog_field({
      column_title: 'PFF Slot Coverage Receptions',
      header_label: 'Slot Receptions'
    }),
    player_pff_slot_coverage_yards: pff_facet_seasonlog_field({
      column_title: 'PFF Slot Coverage Yards',
      header_label: 'Slot Yards'
    }),
    player_pff_slot_coverage_touchdowns: pff_facet_seasonlog_field({
      column_title: 'PFF Slot Coverage Touchdowns',
      header_label: 'Slot TD'
    })
  }

  if (!is_logged_in) {
    Object.keys(fields).forEach((key) => {
      fields[key].hidden = true
    })
  }

  return fields
}
