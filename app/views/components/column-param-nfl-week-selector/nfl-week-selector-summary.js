import React, { useState, useMemo } from 'react'
import PropTypes from 'prop-types'
import Checkbox from '@mui/material/Checkbox'

import { nfl_week_identifier } from '@libs-shared'

import {
  purge_static_group,
  apply_per_week_toggle
} from './nfl-week-selection-mode.js'

export default function NflWeekSelectorSummary({
  current_selection,
  values,
  handle_change,
  push_history_entry,
  dynamic_value_defs
}) {
  const [show_full_list, set_show_full_list] = useState(false)

  const static_selected = useMemo(
    () => (current_selection || []).filter((v) => typeof v === 'string'),
    [current_selection]
  )

  const existing_dynamic = useMemo(
    () =>
      (current_selection || []).filter(
        (v) => v && typeof v === 'object' && v.dynamic_type
      ),
    [current_selection]
  )

  const groups = useMemo(
    () => nfl_week_identifier.group_nfl_weeks({ nfl_weeks: static_selected }),
    [static_selected]
  )

  const sorted_group_keys = useMemo(
    () =>
      Object.keys(groups).sort(nfl_week_identifier.compare_nfl_week_group_keys),
    [groups]
  )

  const grouped_values = useMemo(() => {
    const result = {}
    for (const v of values || []) {
      const parsed = nfl_week_identifier.parse_nfl_week_identifier({
        identifier: v
      })
      if (!parsed) continue
      if (!result[parsed.year]) result[parsed.year] = []
      result[parsed.year].push(v)
    }
    return result
  }, [values])

  const sorted_years = useMemo(
    () =>
      Object.keys(grouped_values)
        .map(Number)
        .sort((a, b) => b - a),
    [grouped_values]
  )

  const dynamic_label_map = useMemo(() => {
    const map = {}
    for (const dv of dynamic_value_defs || []) {
      map[dv.dynamic_type] = dv
    }
    return map
  }, [dynamic_value_defs])

  const is_dynamic_mode = existing_dynamic.length > 0
  const is_static_mode = static_selected.length > 0

  const handle_remove_group = (group_key) => {
    push_history_entry(current_selection)
    handle_change(purge_static_group({ current_selection, group_key }))
  }

  const handle_remove_dynamic = (dynamic_type) => {
    push_history_entry(current_selection)
    handle_change(
      (current_selection || []).filter(
        (v) => !(v && typeof v === 'object' && v.dynamic_type === dynamic_type)
      )
    )
  }

  const handle_toggle_value = (value) => {
    const parsed = nfl_week_identifier.parse_nfl_week_identifier({
      identifier: value
    })
    if (!parsed) return
    push_history_entry(current_selection)
    handle_change(
      apply_per_week_toggle({
        year: parsed.year,
        seas_type: parsed.seas_type,
        week: parsed.week,
        current_selection
      })
    )
  }

  return (
    <div className='nfl-week-selector-section nfl-week-selector-summary'>
      <div className='nfl-week-selector-section-header'>
        {is_dynamic_mode ? 'Dynamic' : 'Static'} (
        {is_dynamic_mode ? existing_dynamic.length : static_selected.length})
      </div>

      {!is_static_mode && !is_dynamic_mode && (
        <div className='nfl-week-selector-summary-empty'>No selection</div>
      )}

      {is_dynamic_mode &&
        existing_dynamic.map((v) => {
          const def = dynamic_label_map[v.dynamic_type]
          const label = def ? def.label : v.dynamic_type
          const value_suffix =
            def && def.has_value_field && v.value != null ? `: ${v.value}` : ''
          return (
            <div
              key={v.dynamic_type}
              className='nfl-week-selector-summary-group'
            >
              <div className='nfl-week-selector-summary-group-label'>
                {label}
                {value_suffix}
              </div>
              <div
                className='nfl-week-selector-summary-group-remove'
                onClick={() => handle_remove_dynamic(v.dynamic_type)}
              >
                Remove
              </div>
            </div>
          )
        })}

      {is_static_mode &&
        sorted_group_keys.map((key) => {
          const weeks = groups[key]
          const [year, seas_type] = key.split('_')
          const range_label =
            seas_type === 'POST'
              ? weeks
                  .map((w) =>
                    nfl_week_identifier.get_postseason_week_label({ week: w })
                  )
                  .join(', ')
              : nfl_week_identifier.format_week_ranges({ weeks })
          return (
            <div key={key} className='nfl-week-selector-summary-group'>
              <div className='nfl-week-selector-summary-group-label'>
                {year} {seas_type}: {range_label}
              </div>
              <div
                className='nfl-week-selector-summary-group-remove'
                onClick={() => handle_remove_group(key)}
              >
                Remove
              </div>
            </div>
          )
        })}

      {is_static_mode && (
        <div
          className='nfl-week-selector-full-list-toggle'
          onClick={() => set_show_full_list(!show_full_list)}
        >
          {show_full_list ? 'Hide full list' : 'Show full list'}
        </div>
      )}

      {is_static_mode && show_full_list && (
        <div className='nfl-week-selector-full-list'>
          {sorted_years.map((year) => (
            <div key={year}>
              <div className='nfl-week-selector-section-header'>{year}</div>
              {grouped_values[year].map((value) => {
                const is_selected = static_selected.includes(value)
                return (
                  <div
                    key={value}
                    className='nfl-week-selector-full-list-item'
                    onClick={() => handle_toggle_value(value)}
                  >
                    <Checkbox checked={is_selected} size='small' />
                    <span>{value}</span>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

NflWeekSelectorSummary.propTypes = {
  current_selection: PropTypes.array.isRequired,
  values: PropTypes.array.isRequired,
  handle_change: PropTypes.func.isRequired,
  push_history_entry: PropTypes.func.isRequired,
  dynamic_value_defs: PropTypes.array
}
