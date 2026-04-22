import React, { useRef, useEffect, useMemo } from 'react'
import PropTypes from 'prop-types'
import Popper from '@mui/material/Popper'
import { ClickAwayListener } from '@mui/base/ClickAwayListener'

import { nfl_week_identifier } from '@libs-shared'

import {
  apply_per_week_toggle,
  apply_season_type_bulk
} from './nfl-week-selection-mode.js'

const {
  WEEK_RANGES,
  format_nfl_week_identifier,
  validate_nfl_week_identifier,
  get_postseason_week_label
} = nfl_week_identifier

const SEASON_TYPES = ['PRE', 'REG', 'POST']

export default function NflWeekSelectorYearPopper({
  year,
  anchor_el,
  current_selection,
  handle_change,
  push_history_entry,
  on_close
}) {
  const drag_ref = useRef(null)
  const last_week_ref = useRef({})

  useEffect(() => {
    const on_document_mouse_up = () => {
      drag_ref.current = null
    }
    document.addEventListener('mouseup', on_document_mouse_up)
    return () => document.removeEventListener('mouseup', on_document_mouse_up)
  }, [])

  const statics_set = useMemo(
    () =>
      new Set((current_selection || []).filter((v) => typeof v === 'string')),
    [current_selection]
  )

  const week_meta_by_type = useMemo(() => {
    const result = {}
    for (const seas_type of SEASON_TYPES) {
      const range = WEEK_RANGES[seas_type]
      if (!range) continue
      const weeks = []
      for (let w = range.min; w <= range.max; w++) {
        const id = format_nfl_week_identifier({ year, seas_type, week: w })
        weeks.push({
          week: w,
          id,
          valid: validate_nfl_week_identifier({ identifier: id }),
          label:
            seas_type === 'POST'
              ? get_postseason_week_label({ week: w })
              : String(w)
        })
      }
      result[seas_type] = weeks
    }
    return result
  }, [year])

  const commit_week = ({ seas_type, week }) => {
    const next = apply_per_week_toggle({
      year,
      seas_type,
      week,
      current_selection
    })
    push_history_entry(current_selection)
    handle_change(next)
  }

  const handle_mouse_down = ({ seas_type, week, is_selected, event }) => {
    if (event?.shiftKey && last_week_ref.current[seas_type] != null) {
      const last = last_week_ref.current[seas_type]
      const start = Math.min(last, week)
      const end = Math.max(last, week)
      const mode = is_selected ? 'deselect' : 'select'
      let next = current_selection
      for (let w = start; w <= end; w++) {
        const id = format_nfl_week_identifier({ year, seas_type, week: w })
        if (!validate_nfl_week_identifier({ identifier: id })) continue
        if (mode === 'select' && !next.includes(id)) {
          next = [...next, id]
        } else if (mode === 'deselect' && next.includes(id)) {
          next = next.filter((v) => v !== id)
        }
      }
      push_history_entry(current_selection)
      handle_change(next)
      last_week_ref.current[seas_type] = week
      return
    }
    drag_ref.current = {
      seas_type,
      mode: is_selected ? 'deselect' : 'select'
    }
    last_week_ref.current[seas_type] = week
    commit_week({ seas_type, week })
  }

  const handle_mouse_enter = ({ seas_type, week, id, valid }) => {
    if (!drag_ref.current || drag_ref.current.seas_type !== seas_type) return
    if (!valid) return
    const currently_selected = statics_set.has(id)
    if (drag_ref.current.mode === 'select' && currently_selected) return
    if (drag_ref.current.mode === 'deselect' && !currently_selected) return
    commit_week({ seas_type, week })
  }

  const handle_mouse_up = () => {
    drag_ref.current = null
  }

  const handle_bulk = ({ seas_type, action }) => {
    const next = apply_season_type_bulk({
      year,
      seas_type,
      action,
      current_selection
    })
    push_history_entry(current_selection)
    handle_change(next)
  }

  return (
    <ClickAwayListener onClickAway={on_close}>
      <Popper
        open
        anchorEl={anchor_el}
        placement='bottom-start'
        className='table-popper nfl-week-selector-year-popper'
      >
        <div
          className='nfl-week-selector-year-popper-body'
          onMouseUp={handle_mouse_up}
        >
          <div className='nfl-week-selector-year-popper-title'>{year}</div>
          {SEASON_TYPES.map((seas_type) => {
            const weeks = week_meta_by_type[seas_type]
            if (!weeks) return null
            return (
              <div
                key={seas_type}
                className='nfl-week-selector-year-popper-section'
              >
                <div className='nfl-week-selector-year-popper-section-head'>
                  <span>{seas_type}</span>
                  <span
                    className='nfl-week-selector-bulk-btn'
                    onClick={() => handle_bulk({ seas_type, action: 'all' })}
                  >
                    All
                  </span>
                  <span
                    className='nfl-week-selector-bulk-btn'
                    onClick={() => handle_bulk({ seas_type, action: 'clear' })}
                  >
                    Clear
                  </span>
                </div>
                <div className='nfl-week-selector-year-popper-weeks'>
                  {weeks.map(({ week, id, valid, label }) => {
                    const is_selected = statics_set.has(id)
                    return (
                      <div
                        key={week}
                        className={`nfl-week-selector-week-btn${is_selected ? ' active' : ''}${valid ? '' : ' disabled'}`}
                        onMouseDown={(e) =>
                          valid &&
                          handle_mouse_down({
                            seas_type,
                            week,
                            is_selected,
                            event: e
                          })
                        }
                        onMouseEnter={() =>
                          valid &&
                          handle_mouse_enter({ seas_type, week, id, valid })
                        }
                      >
                        <span>{label}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </Popper>
    </ClickAwayListener>
  )
}

NflWeekSelectorYearPopper.propTypes = {
  year: PropTypes.number.isRequired,
  anchor_el: PropTypes.any,
  current_selection: PropTypes.array.isRequired,
  handle_change: PropTypes.func.isRequired,
  push_history_entry: PropTypes.func.isRequired,
  on_close: PropTypes.func.isRequired
}
