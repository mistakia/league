import React, { useState, useEffect, useMemo } from 'react'
import PropTypes from 'prop-types'
import Checkbox from '@mui/material/Checkbox'
import TextField from '@mui/material/TextField'

import FilterBase from 'react-table/src/filter-base'
import NflWeekBuilder from './nfl-week-builder.js'
import NflWeekSelectionSummary from './nfl-week-selection-summary.js'
import { nfl_week_identifier } from '@libs-shared'

import './column-param-nfl-week-filter.styl'

export default function ColumnParamNflWeekFilter({
  column_param_name,
  column_param_definition,
  selected_param_values,
  handle_change = () => {},
  mixed_state = false,
  splits = []
}) {
  const label = column_param_definition?.label || column_param_name
  const values = column_param_definition?.values || []
  const dynamic_value_defs = column_param_definition?.dynamic_values || []
  const is_column_param_defined = Boolean(selected_param_values)

  const [trigger_close, set_trigger_close] = useState(null)
  const [dynamic_values, set_dynamic_values] = useState({})

  useEffect(() => {
    const new_dynamic_values = {}
    selected_param_values?.forEach((value) => {
      if (value && typeof value === 'object' && value.dynamic_type) {
        new_dynamic_values[value.dynamic_type] = value.value
      }
    })
    set_dynamic_values(new_dynamic_values)
  }, [selected_param_values])

  const static_selected = useMemo(
    () => (selected_param_values || []).filter((v) => typeof v === 'string'),
    [selected_param_values]
  )

  const existing_dynamic = useMemo(
    () =>
      (selected_param_values || []).filter(
        (v) => v && typeof v === 'object'
      ),
    [selected_param_values]
  )

  const handle_add_weeks = (new_week_ids) => {
    const merged = [...new Set([...static_selected, ...new_week_ids])]
    handle_change([...merged, ...existing_dynamic])
  }

  const handle_remove_group = (group_key) => {
    const prefix = group_key + '_WEEK_'
    const filtered = static_selected.filter((v) => !v.startsWith(prefix))
    handle_change([...filtered, ...existing_dynamic])
  }

  const handle_toggle_value = (value) => {
    const is_selected = static_selected.includes(value)
    const new_static = is_selected
      ? static_selected.filter((v) => v !== value)
      : [...static_selected, value]
    handle_change([...new_static, ...existing_dynamic])
  }

  const handle_dynamic_toggle = (dynamic_type, default_value) => {
    const is_currently_selected = selected_param_values?.some(
      (v) => v && typeof v === 'object' && v.dynamic_type === dynamic_type
    )

    const other_dynamic = existing_dynamic.filter(
      (v) => v.dynamic_type !== dynamic_type
    )

    if (is_currently_selected) {
      handle_change([...static_selected, ...other_dynamic])
    } else {
      const dv = dynamic_values[dynamic_type] || default_value
      handle_change([
        ...static_selected,
        ...other_dynamic,
        { dynamic_type, value: dv }
      ])
    }
  }

  const handle_dynamic_value_change = (dynamic_type, value) => {
    const new_value = value.trim() === '' ? null : value
    set_dynamic_values((prev) => ({
      ...prev,
      [dynamic_type]: new_value
    }))

    const filtered =
      selected_param_values?.filter(
        (v) => typeof v !== 'object' || v.dynamic_type !== dynamic_type
      ) || []

    handle_change(
      new_value !== null
        ? [...filtered, { dynamic_type, value: new_value }]
        : filtered
    )
  }

  const groups = nfl_week_identifier.group_nfl_weeks({ nfl_weeks: static_selected })
  const group_count = Object.keys(groups).length
  const static_count = static_selected.length
  const dynamic_count = Object.keys(dynamic_values).length
  const all_selected =
    !is_column_param_defined || (values.length > 0 && static_count === values.length)
  const selected_label = mixed_state
    ? '-'
    : all_selected
      ? 'ALL'
      : `${static_count + dynamic_count} selected`

  const body = (
    <div className='nfl-week-filter'>
      <div className='table-filter-item-dropdown-head'>
        <div className='controls-button' onClick={() => handle_change(null)}>
          All
        </div>
        <div className='controls-button' onClick={() => handle_change([])}>
          Clear
        </div>
        <div
          className='controls-button close'
          onClick={() => set_trigger_close((prev) => !prev)}>
          Close
        </div>
      </div>

      {dynamic_value_defs.length > 0 && (
        <div className='nfl-week-filter-section'>
          <div className='nfl-week-filter-section-header'>Dynamic</div>
          {dynamic_value_defs.map((dv) => {
            const is_selected =
              !mixed_state &&
              selected_param_values?.some(
                (v) =>
                  typeof v === 'object' &&
                  v !== null &&
                  v.dynamic_type === dv.dynamic_type
              )
            return (
              <div
                key={dv.dynamic_type}
                className={`table-filter-item-dropdown-item${is_selected ? ' selected' : ''}`}
                onClick={() =>
                  handle_dynamic_toggle(dv.dynamic_type, dv.default_value)
                }>
                <Checkbox checked={Boolean(is_selected)} size='small' />
                <div className='table-filter-item-dropdown-item-label'>
                  {dv.label}
                </div>
                {dv.has_value_field && (
                  <TextField
                    size='small'
                    value={dynamic_values[dv.dynamic_type] ?? ''}
                    onChange={(e) =>
                      handle_dynamic_value_change(
                        dv.dynamic_type,
                        e.target.value
                      )
                    }
                    onClick={(e) => e.stopPropagation()}
                    placeholder={dv.default_value?.toString() || ''}
                  />
                )}
              </div>
            )
          })}
        </div>
      )}

      <NflWeekBuilder values={values} on_add={handle_add_weeks} />

      <NflWeekSelectionSummary
        static_selected={static_selected}
        values={values}
        groups={groups}
        group_count={group_count}
        on_remove_group={handle_remove_group}
        on_toggle_value={handle_toggle_value}
      />
    </div>
  )

  return <FilterBase {...{ label, selected_label, body, trigger_close }} />
}

ColumnParamNflWeekFilter.propTypes = {
  handle_change: PropTypes.func,
  column_param_name: PropTypes.string,
  column_param_definition: PropTypes.object,
  selected_param_values: PropTypes.array,
  mixed_state: PropTypes.bool,
  splits: PropTypes.array
}
