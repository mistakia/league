import * as table_constants from 'react-table/src/constants.mjs'

import {
  external_data_sources,
  external_data_source_display_names,
  projection_data_source_ids
} from './constants/source-constants.mjs'

// Projection-source picker for the `projections_index`-backed raw-stat
// projection columns. Values are the selectable projection providers
// (single source of truth: projection_data_source_ids), defaulting to the
// AVERAGE consensus so a column with no `source_id` param renders exactly as it
// did before the param existed.
export const projection_source_param = {
  label: 'Projection Source',
  values: projection_data_source_ids.map((source_id) => ({
    value: source_id,
    label: external_data_source_display_names[source_id]
  })),
  data_type: table_constants.TABLE_DATA_TYPES.SELECT,
  default_value: external_data_sources.AVERAGE,
  single: true
}
