import React, { useState } from 'react'
import PropTypes from 'prop-types'
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined'
import CheckIcon from '@mui/icons-material/Check'

import { BASE_URL } from '@core/constants'
import copy_to_clipboard from '@core/utils/copy-to-clipboard'

import './copy-markdown-button.styl'

// Copies the absolute URL of a markdown context document to the clipboard with
// a 2-second success toggle. `path` is the doc's app-relative markdown path
// (e.g. `/leagues/1.md`); the absolute URL is derived from BASE_URL, not from
// window.location, so it is stable and shareable. Renders as a subtle inline
// link so it reads as a secondary action rather than a prominent button.
export default function CopyMarkdownButton({
  path,
  label = 'copy markdown url'
}) {
  const [copied, set_copied] = useState(false)

  const handle_click = () => {
    copy_to_clipboard(`${BASE_URL}${path}`).then(() => {
      set_copied(true)
      setTimeout(() => set_copied(false), 2000)
    })
  }

  return (
    <button
      type='button'
      className='copy-markdown-button'
      onClick={handle_click}
    >
      {copied ? (
        <CheckIcon fontSize='inherit' />
      ) : (
        <ContentCopyOutlinedIcon fontSize='inherit' />
      )}
      <span>{copied ? 'copied' : label}</span>
    </button>
  )
}

CopyMarkdownButton.propTypes = {
  path: PropTypes.string.isRequired,
  label: PropTypes.string
}
