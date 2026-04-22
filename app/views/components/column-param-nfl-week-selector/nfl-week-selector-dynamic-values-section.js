import React, { useEffect, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import Checkbox from '@mui/material/Checkbox'
import TextField from '@mui/material/TextField'

import {
  apply_dynamic_toggle,
  purge_static
} from './nfl-week-selection-mode.js'

export default function NflWeekSelectorDynamicValuesSection({
  dynamic_value_defs,
  current_selection,
  handle_change,
  push_history_entry,
  mixed_state
}) {
  const [dynamic_values, set_dynamic_values] = useState({})
  const pre_edit_selection_ref = useRef(null)

  useEffect(() => {
    const next = {}
    ;(current_selection || []).forEach((value) => {
      if (value && typeof value === 'object' && value.dynamic_type) {
        next[value.dynamic_type] = value.value
      }
    })
    set_dynamic_values(next)
  }, [current_selection])

  if (!dynamic_value_defs || dynamic_value_defs.length === 0) return null

  const handle_toggle = (dv) => {
    const dynamic_value = dynamic_values[dv.dynamic_type] ?? dv.default_value
    const next = apply_dynamic_toggle({
      dynamic_type: dv.dynamic_type,
      dynamic_value,
      current_selection
    })
    push_history_entry(current_selection)
    handle_change(next)
  }

  const handle_value_change = (dv, raw) => {
    const new_value = raw.trim() === '' ? null : raw
    set_dynamic_values((prev) => ({
      ...prev,
      [dv.dynamic_type]: new_value
    }))
    if (pre_edit_selection_ref.current === null) {
      pre_edit_selection_ref.current = current_selection
    }
    const existing_dynamic = purge_static(current_selection).filter(
      (v) => v.dynamic_type !== dv.dynamic_type
    )
    const next =
      new_value !== null
        ? [
            ...existing_dynamic,
            { dynamic_type: dv.dynamic_type, value: new_value }
          ]
        : existing_dynamic
    handle_change(next)
  }

  const handle_value_commit = () => {
    if (pre_edit_selection_ref.current === null) return
    push_history_entry(pre_edit_selection_ref.current)
    pre_edit_selection_ref.current = null
  }

  return (
    <div className='nfl-week-selector-section'>
      <div className='nfl-week-selector-section-header'>Dynamic</div>
      {dynamic_value_defs.map((dv) => {
        const is_selected =
          !mixed_state &&
          (current_selection || []).some(
            (v) =>
              v && typeof v === 'object' && v.dynamic_type === dv.dynamic_type
          )
        return (
          <div
            key={dv.dynamic_type}
            className={`table-filter-item-dropdown-item${is_selected ? ' selected' : ''}`}
            onClick={() => handle_toggle(dv)}
          >
            <Checkbox checked={Boolean(is_selected)} size='small' />
            <div className='table-filter-item-dropdown-item-label'>
              {dv.label}
            </div>
            {dv.has_value_field && (
              <TextField
                size='small'
                value={dynamic_values[dv.dynamic_type] ?? ''}
                onChange={(e) => handle_value_change(dv, e.target.value)}
                onBlur={handle_value_commit}
                onClick={(e) => e.stopPropagation()}
                placeholder={dv.default_value?.toString() || ''}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

NflWeekSelectorDynamicValuesSection.propTypes = {
  dynamic_value_defs: PropTypes.array.isRequired,
  current_selection: PropTypes.array.isRequired,
  handle_change: PropTypes.func.isRequired,
  push_history_entry: PropTypes.func.isRequired,
  mixed_state: PropTypes.bool
}
