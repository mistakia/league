import React, { useState } from 'react'
import PropTypes from 'prop-types'
import IconButton from '@mui/material/IconButton'
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined'
import CheckIcon from '@mui/icons-material/Check'

import { BASE_URL } from '@core/constants'
import copy_to_clipboard from '@core/utils/copy-to-clipboard'

import './copy-markdown-button.styl'

// Copies the absolute URL of a markdown context document to the clipboard with
// a 2-second success toggle. `path` is the doc's app-relative markdown path
// (e.g. `/leagues/1.md`); the absolute URL is derived from BASE_URL, not from
// window.location, so it is stable and shareable.
export default function CopyMarkdownButton({
  path,
  title = 'Copy as Markdown'
}) {
  const [copied, set_copied] = useState(false)

  const handle_click = () => {
    copy_to_clipboard(`${BASE_URL}${path}`).then(() => {
      set_copied(true)
      setTimeout(() => set_copied(false), 2000)
    })
  }

  return (
    <IconButton
      className='copy-markdown-button'
      onClick={handle_click}
      title={copied ? 'Copied' : title}
      size='small'
    >
      {copied ? (
        <CheckIcon fontSize='small' />
      ) : (
        <ContentCopyOutlinedIcon fontSize='small' />
      )}
    </IconButton>
  )
}

CopyMarkdownButton.propTypes = {
  path: PropTypes.string.isRequired,
  title: PropTypes.string
}
