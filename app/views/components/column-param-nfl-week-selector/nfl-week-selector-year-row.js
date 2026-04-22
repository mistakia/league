import React, { useRef, useEffect, useState, useMemo } from 'react'
import PropTypes from 'prop-types'
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown'

import { nfl_week_identifier } from '@libs-shared'

import NflWeekSelectorYearPopper from './nfl-week-selector-year-popper.js'
import {
  apply_year_selection,
  apply_year_range_selection
} from './nfl-week-selection-mode.js'

const { get_nfl_week_identifiers_for_year, validate_nfl_week_identifier } =
  nfl_week_identifier

const reg_ids_cache = new Map()
const get_validated_reg_ids = (year) => {
  let cached = reg_ids_cache.get(year)
  if (!cached) {
    cached = get_nfl_week_identifiers_for_year({
      year,
      seas_type: 'REG'
    }).filter((id) => validate_nfl_week_identifier({ identifier: id }))
    reg_ids_cache.set(year, cached)
  }
  return cached
}

export default function NflWeekSelectorYearRow({
  sorted_years,
  current_selection,
  handle_change,
  push_history_entry
}) {
  const anchor_year_ref = useRef(null)
  const drag_ref = useRef(null)
  const [open_year, set_open_year] = useState(null)
  const [popper_anchor, set_popper_anchor] = useState(null)
  const [show_all_years, set_show_all_years] = useState(false)

  const DEFAULT_YEAR_COUNT = 10
  const has_more_years = sorted_years.length > DEFAULT_YEAR_COUNT
  const visible_years =
    show_all_years || !has_more_years
      ? sorted_years
      : sorted_years.slice(0, DEFAULT_YEAR_COUNT)
  const hidden_count = sorted_years.length - DEFAULT_YEAR_COUNT

  useEffect(() => {
    const on_document_mouse_up = () => {
      drag_ref.current = null
    }
    document.addEventListener('mouseup', on_document_mouse_up)
    return () => document.removeEventListener('mouseup', on_document_mouse_up)
  }, [])

  const statics_set = useMemo(
    () =>
      new Set(
        (current_selection || []).filter((v) => typeof v === 'string')
      ),
    [current_selection]
  )

  const year_states = useMemo(() => {
    const map = {}
    for (const year of visible_years) {
      const reg_ids = get_validated_reg_ids(year)
      if (reg_ids.length === 0) {
        map[year] = 'none'
        continue
      }
      let hits = 0
      for (const id of reg_ids) if (statics_set.has(id)) hits++
      map[year] = hits === 0 ? 'none' : hits === reg_ids.length ? 'full' : 'partial'
    }
    return map
  }, [visible_years, statics_set])

  const commit = (next) => {
    push_history_entry(current_selection)
    handle_change(next)
  }

  const handle_year_click = (year, event) => {
    if (event.shiftKey && anchor_year_ref.current !== null) {
      const mode = year_states[year] === 'full' ? 'deselect' : 'select'
      commit(
        apply_year_range_selection({
          from_year: anchor_year_ref.current,
          to_year: year,
          current_selection,
          mode
        })
      )
      anchor_year_ref.current = year
      return
    }
    anchor_year_ref.current = year
    commit(apply_year_selection({ year, current_selection }))
  }

  const handle_year_mouse_down = (year, event) => {
    if (event.shiftKey) return
    drag_ref.current = {
      mode: year_states[year] === 'full' ? 'deselect' : 'select',
      last_year: year
    }
  }

  const handle_year_mouse_enter = (year) => {
    if (!drag_ref.current) return
    if (drag_ref.current.last_year === year) return
    const reg_ids = get_validated_reg_ids(year)
    const statics = [...statics_set]
    let next
    if (drag_ref.current.mode === 'select') {
      next = [...new Set([...statics, ...reg_ids])]
    } else {
      const reg_set = new Set(reg_ids)
      next = statics.filter((v) => !reg_set.has(v))
    }
    drag_ref.current.last_year = year
    push_history_entry(current_selection)
    handle_change(next)
  }

  const handle_caret_click = (year, event) => {
    event.stopPropagation()
    if (open_year === year) {
      set_open_year(null)
      set_popper_anchor(null)
      return
    }
    set_open_year(year)
    set_popper_anchor(event.currentTarget)
  }

  const handle_popper_close = () => {
    set_open_year(null)
    set_popper_anchor(null)
  }

  return (
    <div
      className='nfl-week-selector-year-row'
      onMouseUp={() => {
        drag_ref.current = null
      }}
    >
      {visible_years.map((year) => (
        <div key={year} className='nfl-week-selector-year-item'>
          <div
            className={`nfl-week-selector-year-btn ${year_states[year]}`}
            onClick={(e) => handle_year_click(year, e)}
            onMouseDown={(e) => handle_year_mouse_down(year, e)}
            onMouseEnter={() => handle_year_mouse_enter(year)}
          >
            {year}
          </div>
          <div
            className='nfl-week-selector-year-caret'
            onClick={(e) => handle_caret_click(year, e)}
          >
            <ArrowDropDownIcon fontSize='small' />
          </div>
        </div>
      ))}
      {has_more_years && (
        <div
          className='nfl-week-selector-show-more'
          onClick={() => set_show_all_years((prev) => !prev)}
        >
          {show_all_years ? 'Show less' : `Show ${hidden_count} more years`}
        </div>
      )}
      {open_year !== null && popper_anchor && (
        <NflWeekSelectorYearPopper
          year={open_year}
          anchor_el={popper_anchor}
          current_selection={current_selection}
          handle_change={handle_change}
          push_history_entry={push_history_entry}
          on_close={handle_popper_close}
        />
      )}
    </div>
  )
}

NflWeekSelectorYearRow.propTypes = {
  sorted_years: PropTypes.array.isRequired,
  current_selection: PropTypes.array.isRequired,
  handle_change: PropTypes.func.isRequired,
  push_history_entry: PropTypes.func.isRequired
}
