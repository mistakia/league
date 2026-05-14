import React from 'react'
import PropTypes from 'prop-types'

import './data-view-filter-chips.styl'

export default function DataViewFilterChips({
  summaries,
  set_filter_controls_open
}) {
  if (!summaries.length) return null

  // Chip click bypasses the placeholder-injection path that
  // TableFilterControls.handle_menu_toggle runs when its own toggle is clicked
  // (react-table/src/table-filter-controls/table-filter-controls.js:291-310).
  // Intended: a chip click is "inspect existing filters", not "seed new ones".
  // stopPropagation + microtask defer avoids races with the panel's
  // ClickAwayListener firing on the same click event.
  const handle_chip_click = (event) => {
    event.stopPropagation()
    if (typeof set_filter_controls_open !== 'function') return
    setTimeout(() => set_filter_controls_open(true), 0)
  }

  return (
    <div className='data-view-filter-chips'>
      {summaries.map((s) => {
        const value_part = s.value_label ? ` ${s.value_label}` : ''
        const scope_part = s.scope_label ? ` · ${s.scope_label}` : ''
        const label = `${s.column_label} ${s.operator}${value_part}${scope_part}`
        return (
          <button
            key={s.filter_index}
            type='button'
            className='data-view-filter-chip'
            onClick={handle_chip_click}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}

DataViewFilterChips.propTypes = {
  summaries: PropTypes.array,
  set_filter_controls_open: PropTypes.func
}
