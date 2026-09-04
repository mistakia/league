import React from 'react'
import PropTypes from 'prop-types'
import { Link } from 'react-router-dom'

import './data-view-empty-state.styl'

export default function DataViewEmptyState({ has_columns }) {
  // ALWAYS COLLAPSED TO START, and there is deliberately no way back to
  // collapsed once opened. This began as a real disclosure -- a remembered
  // preference, a heuristic default keyed on whether the user had saved views
  // of their own, and a Hide beside the Show -- which is a lot of machinery to
  // decide the state of a three-item tutorial. The tutorial is read once and
  // then it is scenery, so the only state worth having is the one that keeps it
  // out of the way until asked for, and a Hide is a control for putting back
  // something the user just asked to see.
  const [is_quick_start_shown, set_is_quick_start_shown] = React.useState(false)

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
      {/* Both entry paths in one line, in the order they sit on screen: the
          describe box is directly above this, and Columns is in the strip
          above that. Naming only one of them left the other undiscovered. */}
      <div className='data-view-empty-state__lede'>
        Open <strong>Columns</strong> and add a field, or{' '}
        <strong>describe a view</strong> and have it built for you.
      </div>
      <div className='data-view-empty-state__quick-start'>
        {is_quick_start_shown ? (
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
        ) : (
          <button
            type='button'
            className='data-view-empty-state__reveal'
            onClick={() => set_is_quick_start_shown(true)}
          >
            Show quick start
          </button>
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
  has_columns: PropTypes.bool
}
