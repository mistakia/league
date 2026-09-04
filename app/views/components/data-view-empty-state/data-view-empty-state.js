/* global localStorage */
import React from 'react'
import PropTypes from 'prop-types'
import { Link } from 'react-router-dom'

import Icon from '@components/icon'

import './data-view-empty-state.styl'

// Whether the quick start is expanded, remembered across visits. Read and
// written directly rather than through localStorageAdapter, whose getItem is a
// promise -- an async read cannot supply a first-render default, and a guide
// that pops open one frame after the empty state has already drawn is worse
// than one that was never offered.
const QUICK_START_STORAGE_KEY = 'data_view_quick_start_expanded'

const read_stored_preference = () => {
  try {
    const raw = localStorage.getItem(QUICK_START_STORAGE_KEY)
    if (raw === null) return null
    return raw === 'true'
  } catch (error) {
    // Storage can be unreadable (private mode, a full quota, a disabled
    // third-party cookie policy). No preference is a fine answer here.
    return null
  }
}

const write_stored_preference = (is_expanded) => {
  try {
    localStorage.setItem(QUICK_START_STORAGE_KEY, String(is_expanded))
  } catch (error) {
    // Nothing depends on the write landing -- the guide simply reverts to its
    // default on the next visit.
  }
}

export default function DataViewEmptyState({ has_columns, has_saved_views }) {
  // Expanded by default only for someone with no saved views of their own.
  // Progressive disclosure is the point: a returning user creating their
  // fifteenth view gets the one-line prompt and a control, not the tutorial,
  // and an explicit choice outranks the heuristic in both directions.
  const [is_quick_start_expanded, set_is_quick_start_expanded] = React.useState(
    () => {
      const stored = read_stored_preference()
      return stored === null ? !has_saved_views : stored
    }
  )

  const toggle_quick_start = () => {
    const next = !is_quick_start_expanded
    set_is_quick_start_expanded(next)
    write_stored_preference(next)
  }

  if (has_columns) {
    return (
      <div className='data-view-empty-state'>
        <div className='data-view-empty-state__headline'>
          No rows match this view.
        </div>
        <div className='data-view-empty-state__lede'>
          Loosen a filter, or widen the season and week parameters on a column.
        </div>
        <div className='data-view-empty-state__links'>
          <Link to='/guides/data-views'>Data views guide</Link>
          <Link to='/glossary'>Glossary</Link>
        </div>
      </div>
    )
  }

  return (
    <div className='data-view-empty-state'>
      <div className='data-view-empty-state__headline'>
        This view has no columns yet.
      </div>
      <div className='data-view-empty-state__lede'>
        Open <strong>Columns</strong> and add a field to see data.
      </div>
      {/* The steps and the tip live INSIDE the disclosure element the toggle
          heads, rather than beside it, so what the control owns is visible
          from the layout alone whether it is open or closed. */}
      <div className='data-view-empty-state__quick-start'>
        <button
          type='button'
          className='data-view-empty-state__toggle'
          aria-expanded={is_quick_start_expanded}
          onClick={toggle_quick_start}
        >
          <span>Quick start</span>
          <Icon
            className='data-view-empty-state__chevron'
            name='down'
            small
            flipped={is_quick_start_expanded}
          />
        </button>
        {is_quick_start_expanded && (
          <div className='data-view-empty-state__panel'>
            <ol className='data-view-empty-state__steps'>
              <li>
                <strong>Columns</strong> — add the fields you want to see.
                Expand a selected field to set its parameters, such as season or
                week.
              </li>
              <li>
                <strong>Filter</strong> — add conditions that narrow which
                players or teams come back.
              </li>
              <li>
                <strong>Splits</strong> — break each row out by season or week.
              </li>
            </ol>
            <div className='data-view-empty-state__tip'>
              Click a column header to sort. The view menu copies a share link
              and exports CSV.
            </div>
          </div>
        )}
      </div>
      <div className='data-view-empty-state__links'>
        <Link to='/guides/data-views'>Data views guide</Link>
        <Link to='/glossary'>Glossary</Link>
      </div>
    </div>
  )
}

DataViewEmptyState.propTypes = {
  has_columns: PropTypes.bool,
  has_saved_views: PropTypes.bool
}
