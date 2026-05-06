// useReducer is the deliberate choice for history state even though no other
// league component uses it: the { past, present, future } shape with push /
// undo / redo actions is the textbook reducer case.
import React, { useState, useReducer, useMemo, useCallback } from 'react'
import PropTypes from 'prop-types'
import Tooltip from '@mui/material/Tooltip'

import FilterBase from 'react-table/src/filter-base'
import { format_column_params } from 'react-table/src/utils/format-column-params.js'
import { nfl_week_identifier } from '@libs-shared'

import NflWeekSelectorDynamicValuesSection from './nfl-week-selector-dynamic-values-section.js'
import NflWeekSelectorYearRow from './nfl-week-selector-year-row.js'
import NflWeekSelectorSummary from './nfl-week-selector-summary.js'
import NflWeekSelectorHistoryControls from './nfl-week-selector-history-controls.js'
import {
  create_initial_history,
  push_history,
  undo_history,
  redo_history,
  can_undo,
  can_redo
} from './nfl-week-selection-history.js'

import './column-param-nfl-week-selector.styl'

const history_reducer = (state, action) => {
  switch (action.type) {
    case 'push':
      return push_history({ history: state, next_present: action.next_present })
    case 'undo':
      return undo_history(state)
    case 'redo':
      return redo_history(state)
    default:
      return state
  }
}

export default function ColumnParamNflWeekSelector({
  column_param_name,
  column_param_definition,
  selected_param_values,
  handle_change = () => {},
  mixed_state = false
}) {
  const label = column_param_definition?.label || column_param_name
  const values = useMemo(
    () => column_param_definition?.values || [],
    [column_param_definition]
  )
  const dynamic_value_defs = column_param_definition?.dynamic_values || []
  const is_column_param_defined = Boolean(selected_param_values)

  const [trigger_close, set_trigger_close] = useState(null)
  const [history, dispatch_history] = useReducer(
    history_reducer,
    selected_param_values || [],
    create_initial_history
  )

  const current_selection = useMemo(
    () => selected_param_values || [],
    [selected_param_values]
  )

  const push_history_entry = useCallback((prev_selection) => {
    dispatch_history({ type: 'push', next_present: prev_selection })
  }, [])

  const handle_undo = useCallback(() => {
    const next = undo_history(history)
    if (next === history) return
    dispatch_history({ type: 'undo' })
    handle_change(next.present)
  }, [history, handle_change])

  const handle_redo = useCallback(() => {
    const next = redo_history(history)
    if (next === history) return
    dispatch_history({ type: 'redo' })
    handle_change(next.present)
  }, [history, handle_change])

  const sorted_years = useMemo(() => {
    const { years } = nfl_week_identifier.decompose_nfl_weeks({
      nfl_weeks: values
    })
    return years.sort((a, b) => b - a)
  }, [values])

  const static_selected = useMemo(
    () => current_selection.filter((v) => typeof v === 'string'),
    [current_selection]
  )

  const existing_dynamic = useMemo(
    () =>
      current_selection.filter(
        (v) => v && typeof v === 'object' && v.dynamic_type
      ),
    [current_selection]
  )

  const default_dynamic = column_param_definition?.default_value
  const is_default_dynamic =
    default_dynamic &&
    typeof default_dynamic === 'object' &&
    default_dynamic.dynamic_type &&
    existing_dynamic.length === 1 &&
    existing_dynamic[0].dynamic_type === default_dynamic.dynamic_type &&
    static_selected.length === 0

  const static_count = static_selected.length

  const all_selected =
    is_default_dynamic ||
    !is_column_param_defined ||
    (values.length > 0 && static_count === values.length)

  const selected_label = mixed_state
    ? '-'
    : all_selected
      ? 'ALL'
      : format_column_params({
          column_def: {
            column_params: { [column_param_name]: column_param_definition }
          },
          column_state_params: { [column_param_name]: selected_param_values },
          variant: 'short',
          default_label: 'ALL'
        })

  const handle_reset_to_default = useCallback(() => {
    push_history_entry(current_selection)
    if (default_dynamic && typeof default_dynamic === 'object') {
      handle_change([default_dynamic])
    } else {
      handle_change(null)
    }
  }, [push_history_entry, current_selection, default_dynamic, handle_change])

  const handle_clear = useCallback(() => {
    push_history_entry(current_selection)
    handle_change([])
  }, [push_history_entry, current_selection, handle_change])

  const handle_year_all = useCallback(() => {
    push_history_entry(current_selection)
    const all_reg = sorted_years.flatMap((y) =>
      nfl_week_identifier
        .get_nfl_week_identifiers_for_year({ year: y, seas_type: 'REG' })
        .filter((id) =>
          nfl_week_identifier.validate_nfl_week_identifier({ identifier: id })
        )
    )
    handle_change(all_reg)
  }, [push_history_entry, current_selection, sorted_years, handle_change])

  const handle_year_clear = useCallback(() => {
    push_history_entry(current_selection)
    handle_change(existing_dynamic)
  }, [push_history_entry, current_selection, existing_dynamic, handle_change])

  const body = (
    <div className='nfl-week-selector'>
      <div className='table-filter-item-dropdown-head'>
        <NflWeekSelectorHistoryControls
          can_undo={can_undo(history)}
          can_redo={can_redo(history)}
          on_undo={handle_undo}
          on_redo={handle_redo}
        />
        <div className='controls-button' onClick={handle_reset_to_default}>
          All
        </div>
        <div className='controls-button' onClick={handle_clear}>
          Clear
        </div>
        <div
          className='controls-button close'
          onClick={() => set_trigger_close((prev) => !prev)}
        >
          Close
        </div>
      </div>

      <NflWeekSelectorDynamicValuesSection
        dynamic_value_defs={dynamic_value_defs}
        current_selection={current_selection}
        handle_change={handle_change}
        push_history_entry={push_history_entry}
        mixed_state={mixed_state}
      />

      <div className='nfl-week-selector-section'>
        <div className='nfl-week-selector-section-head'>
          <div className='nfl-week-selector-section-header'>Years</div>
          <span
            className='nfl-week-selector-bulk-btn'
            onClick={handle_year_all}
          >
            All
          </span>
          <span
            className='nfl-week-selector-bulk-btn'
            onClick={handle_year_clear}
          >
            Clear
          </span>
        </div>
        <div className='nfl-week-selector-note'>
          Click a year to toggle full season weeks. Click the arrow for week
          selection.
        </div>
        <NflWeekSelectorYearRow
          sorted_years={sorted_years}
          current_selection={current_selection}
          handle_change={handle_change}
          push_history_entry={push_history_entry}
        />
      </div>

      <NflWeekSelectorSummary
        current_selection={current_selection}
        values={values}
        handle_change={handle_change}
        push_history_entry={push_history_entry}
        dynamic_value_defs={dynamic_value_defs}
      />
    </div>
  )

  return (
    <Tooltip title={selected_label}>
      <span className='nfl-week-selector-chip'>
        <FilterBase {...{ label, selected_label, body, trigger_close }} />
      </span>
    </Tooltip>
  )
}

ColumnParamNflWeekSelector.propTypes = {
  handle_change: PropTypes.func,
  column_param_name: PropTypes.string,
  column_param_definition: PropTypes.object,
  selected_param_values: PropTypes.array,
  mixed_state: PropTypes.bool
}
