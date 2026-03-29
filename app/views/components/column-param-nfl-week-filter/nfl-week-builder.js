import React, { useState, useCallback, useRef, useMemo } from 'react'
import PropTypes from 'prop-types'

import { nfl_week_identifier } from '@libs-shared'

const SEASON_TYPES = ['PRE', 'REG', 'POST']

export default function NflWeekBuilder({ values, on_add }) {
  const { years: available_years } = useMemo(
    () => nfl_week_identifier.decompose_nfl_weeks({ nfl_weeks: values }),
    [values]
  )
  const sorted_years = [...available_years].sort((a, b) => b - a)

  const [selected_years, set_selected_years] = useState([])
  const [selected_weeks, set_selected_weeks] = useState({})
  const drag_ref = useRef(null)
  const last_year_index_ref = useRef(null)
  const last_week_index_ref = useRef({})

  const has_any_weeks = SEASON_TYPES.some(
    (t) => (selected_weeks[t] || []).length > 0
  )

  const auto_select_reg_weeks = () => {
    if (has_any_weeks) return
    const max = nfl_week_identifier.get_max_weeks_for_season_type({
      seas_type: 'REG'
    })
    set_selected_weeks((prev) => ({
      ...prev,
      REG: Array.from({ length: max }, (_, i) => i + 1)
    }))
  }

  const toggle_year = (year, event) => {
    if (event?.shiftKey && last_year_index_ref.current !== null) {
      const last_idx = sorted_years.indexOf(last_year_index_ref.current)
      const curr_idx = sorted_years.indexOf(year)
      if (last_idx !== -1 && curr_idx !== -1) {
        const start = Math.min(last_idx, curr_idx)
        const end = Math.max(last_idx, curr_idx)
        const range = sorted_years.slice(start, end + 1)
        set_selected_years((prev) => [...new Set([...prev, ...range])])
        auto_select_reg_weeks()
        last_year_index_ref.current = year
        return
      }
    }
    last_year_index_ref.current = year
    const is_deselecting = selected_years.includes(year)
    set_selected_years((prev) =>
      prev.includes(year) ? prev.filter((y) => y !== year) : [...prev, year]
    )
    if (!is_deselecting) {
      auto_select_reg_weeks()
    }
  }

  const toggle_week = (seas_type, week, event) => {
    if (event?.shiftKey && last_week_index_ref.current[seas_type] != null) {
      const last = last_week_index_ref.current[seas_type]
      const start = Math.min(last, week)
      const end = Math.max(last, week)
      const range = Array.from({ length: end - start + 1 }, (_, i) => start + i)
      set_selected_weeks((prev) => {
        const type_weeks = prev[seas_type] || []
        return { ...prev, [seas_type]: [...new Set([...type_weeks, ...range])] }
      })
      last_week_index_ref.current = {
        ...last_week_index_ref.current,
        [seas_type]: week
      }
      return
    }
    last_week_index_ref.current = {
      ...last_week_index_ref.current,
      [seas_type]: week
    }
    set_selected_weeks((prev) => {
      const type_weeks = prev[seas_type] || []
      const next = type_weeks.includes(week)
        ? type_weeks.filter((w) => w !== week)
        : [...type_weeks, week]
      return { ...prev, [seas_type]: next }
    })
  }

  const select_all_weeks = (seas_type) => {
    const max = nfl_week_identifier.get_max_weeks_for_season_type({ seas_type })
    const all = Array.from({ length: max }, (_, i) => i + 1)
    set_selected_weeks((prev) => ({ ...prev, [seas_type]: all }))
  }

  const clear_all_weeks = (seas_type) => {
    set_selected_weeks((prev) => ({ ...prev, [seas_type]: [] }))
  }

  const handle_mouse_down = useCallback((seas_type, week, is_selected, event) => {
    if (event?.shiftKey) {
      toggle_week(seas_type, week, event)
      return
    }
    drag_ref.current = {
      seas_type,
      mode: is_selected ? 'deselect' : 'select'
    }
    toggle_week(seas_type, week)
  }, [])

  const handle_mouse_enter = useCallback(
    (seas_type, week) => {
      if (!drag_ref.current || drag_ref.current.seas_type !== seas_type) return
      set_selected_weeks((prev) => {
        const type_weeks = prev[seas_type] || []
        if (drag_ref.current.mode === 'select') {
          return type_weeks.includes(week)
            ? prev
            : { ...prev, [seas_type]: [...type_weeks, week] }
        } else {
          return { ...prev, [seas_type]: type_weeks.filter((w) => w !== week) }
        }
      })
    },
    []
  )

  const handle_mouse_up = useCallback(() => {
    drag_ref.current = null
  }, [])

  const handle_add = () => {
    const new_ids = []
    for (const year of selected_years) {
      for (const seas_type of SEASON_TYPES) {
        const weeks = selected_weeks[seas_type] || []
        for (const week of weeks) {
          const id = nfl_week_identifier.format_nfl_week_identifier({ year, seas_type, week })
          if (nfl_week_identifier.validate_nfl_week_identifier({ identifier: id })) {
            new_ids.push(id)
          }
        }
      }
    }
    if (new_ids.length > 0) {
      on_add(new_ids)
      set_selected_years([])
      set_selected_weeks({})
    }
  }

  const has_years = selected_years.length > 0
  const has_weeks = SEASON_TYPES.some(
    (t) => (selected_weeks[t] || []).length > 0
  )
  const has_selection = has_years && has_weeks

  const missing_parts = []
  if (!has_years) missing_parts.push('year')
  if (!has_weeks) missing_parts.push('weeks')

  return (
    <div className='nfl-week-filter-section' onMouseUp={handle_mouse_up}>
      <div className='nfl-week-filter-section-header'>Builder</div>

      <div className='nfl-week-builder-row'>
        <div className='nfl-week-builder-label'>Year</div>
        {sorted_years.map((year) => (
          <div
            key={year}
            className={`nfl-week-toggle-btn${selected_years.includes(year) ? ' active' : ''}`}
            onClick={(e) => toggle_year(year, e)}>
            {year}
          </div>
        ))}
      </div>

      <div className='nfl-week-builder-hint'>
        Shift+click to select range, drag weeks to select
      </div>

      {SEASON_TYPES.map((seas_type) => {
        const max = nfl_week_identifier.get_max_weeks_for_season_type({ seas_type })
        const type_weeks = selected_weeks[seas_type] || []
        return (
          <div key={seas_type} className='nfl-week-week-row'>
            <div className='nfl-week-week-row-label'>{seas_type}</div>
            {Array.from({ length: max }, (_, i) => i + 1).map((week) => {
              const is_selected = type_weeks.includes(week)
              const btn_label =
                seas_type === 'POST'
                  ? nfl_week_identifier.get_postseason_week_label({ week })
                  : week
              return (
                <div
                  key={week}
                  className={`nfl-week-toggle-btn${is_selected ? ' active' : ''}`}
                  onMouseDown={(e) =>
                    handle_mouse_down(seas_type, week, is_selected, e)
                  }
                  onMouseEnter={() => handle_mouse_enter(seas_type, week)}>
                  {btn_label}
                </div>
              )
            })}
            <div
              className='nfl-week-toggle-btn'
              onClick={() => select_all_weeks(seas_type)}>
              All
            </div>
            <div
              className='nfl-week-toggle-btn'
              onClick={() => clear_all_weeks(seas_type)}>
              Clear
            </div>
          </div>
        )
      })}

      <div className='nfl-week-builder-add'>
        <div
          className={`controls-button${has_selection ? '' : ' disabled'}`}
          onClick={has_selection ? handle_add : undefined}>
          Add to Selection
        </div>
        {!has_selection && missing_parts.length > 0 && (
          <div className='nfl-week-builder-missing'>
            Select {missing_parts.join(', ')}
          </div>
        )}
      </div>
    </div>
  )
}

NflWeekBuilder.propTypes = {
  values: PropTypes.array.isRequired,
  on_add: PropTypes.func.isRequired
}
