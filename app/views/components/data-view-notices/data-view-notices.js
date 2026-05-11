import React, { useState } from 'react'
import PropTypes from 'prop-types'

import './data-view-notices.styl'

const InfoGlyph = () => (
  <svg
    className='data-view-notice__icon'
    viewBox='0 0 24 24'
    width='16'
    height='16'
    aria-hidden='true'
    focusable='false'>
    <path
      fill='currentColor'
      d='M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm1 15h-2v-6h2zm0-8h-2V7h2z'
    />
  </svg>
)

export default function DataViewNotices({ notices }) {
  const [dismissed, set_dismissed] = useState({})

  if (!notices.length) return null

  const visible = notices.filter(
    (n) => !dismissed[`${n.code}:${n.filter_index}`]
  )
  if (!visible.length) return null

  return (
    <div className='data-view-notices'>
      {visible.map((n) => {
        const key = `${n.code}:${n.filter_index}`
        return (
          <div key={key} className='data-view-notice'>
            <InfoGlyph />
            <span className='data-view-notice__message'>{n.message}</span>
            <button
              type='button'
              className='data-view-notice__dismiss'
              aria-label='Dismiss notice'
              onClick={() => set_dismissed({ ...dismissed, [key]: true })}>
              ×
            </button>
          </div>
        )
      })}
    </div>
  )
}

DataViewNotices.propTypes = {
  notices: PropTypes.array
}
