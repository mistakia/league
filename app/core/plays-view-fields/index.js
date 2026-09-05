import React from 'react'
import PropTypes from 'prop-types'
import * as table_constants from 'react-table/src/constants.mjs'

import plays_view_columns from '#libs-shared/plays-view-columns.mjs'
import PlayFilmLink from '@components/play-film-link'
import TeamCodeColumn from '@components/team-code-column'

// The plays-view client fields, built from the shared column declaration in
// libs-shared/plays-view-columns.mjs. A column's id, group, label, size and
// data type are stated once there and read here; the only thing this file owns
// is what cannot cross into libs-shared -- the React components that render a
// cell.
//
// Optional keys a declaration may carry, beyond the kind/size/header_label
// resolved below:
//
//   cell                 - names an entry in CELL_COMPONENTS, rendering the
//                          cell in place of the plain-text path (react-table's
//                          table-cell.js dispatches on `component`)
//   justify_content      - CSS justify-content for the cell, e.g. 'flex-start'
//                          to left-align the text. Cells center by default.
//   disable_percentiles  - bool. Suppresses shading on a numeric column. See
//                          the rule below for which ones
//
// react-table also reads `reverse_percentiles` on a cell to pick the shading
// direction, for a column where a LOWER value is the better one. NOTHING sets
// it, because every column that still shades is one where higher is better for
// the offense -- but a column that set it and was not honored here would get a
// flipped color over unflipped percentile points, which is worse than either
// consistent answer. Add it to the declaration if such a column ever arrives.
//
// Percentile shading is implicit: every NUMBER column gets it unless it opts
// out. See app/core/plays-view/derive-plays-percentile-stats.mjs.
//
// THE RULE FOR disable_percentiles: shade what the play PRODUCED, not the
// circumstance it was run in. A percentile answers "how does this compare to
// the others", which is a question worth asking of yards, EPA and CPOE, and
// not of the down, the distance, the field position, the clock, the score, the
// defensive alignment, or the pre-snap EP/WP/xpass expectations those inputs
// produce. Shading the circumstance colors the situation rather than the
// performance, and reads as signal when it is not. Roughly: the OUTCOME,
// PASSING, RUSHING and RECEIVING groups shade; CORE, CONTEXT and PERSONNEL do
// not. The groups are a good summary of the rule, not the mechanism -- EP, WP
// and XPASS sit in OUTCOME and are opted out individually, because they are
// inputs to EPA and WPA rather than results.
//
// Only `columns` shade, never `prefix_columns` -- the selector walks the one
// list, the same way the data-views page does. So the default view's numeric
// prefix columns (play_year, play_week, play_quarter) render unshaded no matter
// what these flags say, and disable_percentiles on them matters only once
// someone adds them as ORDINARY columns, where it does fire. Worth knowing
// before concluding from the default view that a flag is or is not working.

const PlayFilmLinkCell = ({ value }) => <PlayFilmLink url={value} />

PlayFilmLinkCell.propTypes = {
  value: PropTypes.string
}

// The one thing a shared declaration cannot hold: a React component.
const CELL_COMPONENTS = {
  PlayFilmLinkCell: React.memo(PlayFilmLinkCell),
  TeamCodeColumn: React.memo(TeamCodeColumn)
}

const PLAYS_COLUMN_GROUPS = {
  CORE: { column_group_id: 'CORE', priority: 1 },
  OUTCOME: { column_group_id: 'OUTCOME', priority: 2 },
  PASSING: { column_group_id: 'PASSING', priority: 3 },
  RUSHING: { column_group_id: 'RUSHING', priority: 3 },
  RECEIVING: { column_group_id: 'RECEIVING', priority: 3 },
  CONTEXT: { column_group_id: 'CONTEXT', priority: 4 },
  PERSONNEL: { column_group_id: 'PERSONNEL', priority: 4 },
  SITUATIONAL: { column_group_id: 'SITUATIONAL', priority: 5 }
}

const DEFAULT_DATA_TYPE_BY_KIND = {
  number: table_constants.TABLE_DATA_TYPES.NUMBER,
  text: table_constants.TABLE_DATA_TYPES.TEXT,
  boolean: table_constants.TABLE_DATA_TYPES.BOOLEAN
}

const DEFAULT_SIZE_BY_KIND = { number: 70, text: 100, boolean: 60 }

const build_field = (column_id, declaration) => {
  const {
    kind,
    group,
    header_label,
    size,
    data_type,
    column_values,
    fixed,
    disable_percentiles,
    cell,
    justify_content,
    description
  } = declaration

  const column_group = PLAYS_COLUMN_GROUPS[group]
  if (!column_group) {
    throw new Error(`${column_id}: unknown column group ${group}`)
  }

  const resolved_data_type = data_type
    ? table_constants.TABLE_DATA_TYPES[data_type]
    : DEFAULT_DATA_TYPE_BY_KIND[kind]
  if (!resolved_data_type) {
    throw new Error(`${column_id}: unknown data type ${data_type || kind}`)
  }

  const field = {
    column_id,
    accessorKey: column_id,
    data_type: resolved_data_type,
    size: size ?? DEFAULT_SIZE_BY_KIND[kind],
    column_groups: [column_group],
    header_label,
    description: description || null
  }

  if (column_values) field.column_values = column_values
  if (fixed !== undefined) field.fixed = fixed
  if (justify_content) field.justify_content = justify_content
  if (disable_percentiles) field.disable_percentiles = true
  if (cell) {
    const component = CELL_COMPONENTS[cell]
    if (!component) throw new Error(`${column_id}: unknown cell ${cell}`)
    field.component = component
  }

  return field
}

const plays_view_fields = {}

for (const [column_id, declaration] of Object.entries(plays_view_columns)) {
  plays_view_fields[column_id] = build_field(column_id, declaration)
}

export default plays_view_fields
