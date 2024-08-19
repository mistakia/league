import React, { useState } from 'react'
import PropTypes from 'prop-types'

import { get_string_from_object } from '#libs-shared'

import './notices.styl'

export default function Notices({ notices }) {
  const [expanded, set_expanded] = useState(false)

  if (notices.length === 0) {
    return null
  }

  if (notices.length === 1) {
    return notices
  }

  return (
    <div
      className={get_string_from_object({
        'notices-container': true,
        '-expanded': expanded
      })}
    >
      <div className='notices-toggle' onClick={() => set_expanded(!expanded)}>
        {expanded
          ? 'Hide notifications'
          : `Show ${notices.length} notifications`}
      </div>
      {expanded && notices}
    </div>
  )
}

Notices.propTypes = {
  notices: PropTypes.array.isRequired
}
