import { Map } from 'immutable'
import { createSelector } from 'reselect'
import * as table_constants from 'react-table/src/constants.mjs'

import { get_data_views_fields } from '@core/data-views-fields'
import { serialize_preset_value } from '#libs-shared'

const get_param_option_counts_state = (state) =>
  state.getIn(['data_view_request', 'param_option_counts'], Map())

export const get_enriched_data_views_fields = createSelector(
  get_data_views_fields,
  get_param_option_counts_state,
  (fields, param_option_counts) => {
    if (!param_option_counts || param_option_counts.size === 0) return fields

    const enriched = {}
    for (const [field_key, field] of Object.entries(fields)) {
      const column_params = field?.column_params
      if (!column_params) {
        enriched[field_key] = field
        continue
      }
      let column_params_changed = false
      const next_column_params = {}
      for (const [param_name, param_definition] of Object.entries(
        column_params
      )) {
        const param_counts = param_option_counts.get(param_name)
        if (
          param_definition?.data_type !==
            table_constants.TABLE_DATA_TYPES.OBJECT_PRESET ||
          !Array.isArray(param_definition.preset_values) ||
          !param_counts
        ) {
          next_column_params[param_name] = param_definition
          continue
        }
        const next_preset_values = param_definition.preset_values.map(
          (preset) => {
            const signature = serialize_preset_value(preset.value)
            const live = param_counts.get(signature)
            if (typeof live === 'number') {
              return { ...preset, n: live }
            }
            return preset
          }
        )
        next_column_params[param_name] = {
          ...param_definition,
          preset_values: next_preset_values
        }
        column_params_changed = true
      }
      enriched[field_key] = column_params_changed
        ? { ...field, column_params: next_column_params }
        : field
    }
    return enriched
  }
)
