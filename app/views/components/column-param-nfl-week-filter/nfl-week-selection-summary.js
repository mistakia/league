import React, { useState, useMemo } from 'react'
import PropTypes from 'prop-types'
import Checkbox from '@mui/material/Checkbox'

import { nfl_week_identifier } from '@libs-shared'

export default function NflWeekSelectionSummary({
  static_selected,
  values,
  groups,
  group_count,
  on_remove_group,
  on_toggle_value
}) {
  const [show_full_list, set_show_full_list] = useState(false)

  const sorted_group_keys = useMemo(() => {
    return Object.keys(groups).sort((a, b) => {
      const [ya, ta] = a.split('_')
      const [yb, tb] = b.split('_')
      if (ya !== yb) return parseInt(yb, 10) - parseInt(ya, 10)
      const type_order = { PRE: 0, REG: 1, POST: 2 }
      return (type_order[ta] ?? 0) - (type_order[tb] ?? 0)
    })
  }, [groups])

  const grouped_values = useMemo(() => {
    const result = {}
    for (const v of values) {
      const parsed = nfl_week_identifier.parse_nfl_week_identifier({ identifier: v })
      if (!parsed) continue
      if (!result[parsed.year]) result[parsed.year] = []
      result[parsed.year].push(v)
    }
    return result
  }, [values])

  const sorted_years = useMemo(() => {
    return Object.keys(grouped_values)
      .map(Number)
      .sort((a, b) => b - a)
  }, [grouped_values])

  return (
    <div className='nfl-week-filter-section'>
      <div className='nfl-week-filter-section-header'>
        Selection ({static_selected.length})
      </div>

      {group_count === 0 && (
        <div className='nfl-week-summary-count'>No weeks selected</div>
      )}

      {sorted_group_keys.map((key) => {
        const weeks = groups[key]
        const [year, seas_type] = key.split('_')
        const range_label =
          seas_type === 'POST'
            ? weeks
                .map((w) => nfl_week_identifier.get_postseason_week_label({ week: w }))
                .join(', ')
            : nfl_week_identifier.format_week_ranges({ weeks })

        return (
          <div key={key} className='nfl-week-summary-group'>
            <div className='nfl-week-summary-group-label'>
              {year} {seas_type}: {range_label}
            </div>
            <div
              className='nfl-week-summary-group-remove'
              onClick={() => on_remove_group(key)}>
              Remove
            </div>
          </div>
        )
      })}

      <div
        className='nfl-week-full-list-toggle'
        onClick={() => set_show_full_list(!show_full_list)}>
        {show_full_list ? 'Hide full list' : 'Show full list'}
      </div>

      {show_full_list && (
        <div className='nfl-week-full-list'>
          {sorted_years.map((year) => (
            <div key={year}>
              <div className='nfl-week-filter-section-header'>{year}</div>
              {grouped_values[year].map((value) => {
                const is_selected = static_selected.includes(value)
                return (
                  <div
                    key={value}
                    className='nfl-week-full-list-item'
                    onClick={() => on_toggle_value(value)}>
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

NflWeekSelectionSummary.propTypes = {
  static_selected: PropTypes.array.isRequired,
  values: PropTypes.array.isRequired,
  groups: PropTypes.object.isRequired,
  group_count: PropTypes.number.isRequired,
  on_remove_group: PropTypes.func.isRequired,
  on_toggle_value: PropTypes.func.isRequired
}
