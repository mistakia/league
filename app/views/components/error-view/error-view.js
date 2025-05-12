import React, { useState } from 'react'
import PropTypes from 'prop-types'
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined'
import CheckIcon from '@mui/icons-material/Check'

import { DISCORD_URL } from '@core/constants'
import './error-view.styl'
import '@styles/button.styl'

// This component is designed to work with Bugsnag's ErrorBoundary as a FallbackComponent
const ErrorView = ({ error, info }) => {
  const [copy_success, set_copy_success] = useState(false)

  const error_details = {
    timestamp: new Date().toISOString(),
    url: window.location.href,
    error_message: error ? error.toString() : 'Unknown error',
    component_stack: info ? info.componentStack : 'No component stack available'
  }

  const error_text = JSON.stringify(error_details, null, 2)

  const copy_to_clipboard = () => {
    navigator.clipboard
      .writeText(error_text)
      .then(() => {
        set_copy_success(true)
        setTimeout(() => set_copy_success(false), 2000)
      })
      .catch((err) => console.error('Failed to copy text: ', err))
  }

  const reload_page = () => {
    window.location.reload()
  }

  return (
    <div className='error_view'>
      <div className='error_view_content'>
        <h1>Something unexpected happened</h1>
        <p>This error has been automatically captured and reported.</p>
        <p>
          Please reach out in our{' '}
          <a href={DISCORD_URL} target='_blank' rel='noopener noreferrer'>
            Discord support channel
          </a>{' '}
          to bring attention to this issue.
        </p>

        <div className='error_details'>
          <h3>Error Details</h3>
          <div className='error_code_container'>
            <pre className='error_code'>{error_text}</pre>
            <div
              className='copy_icon_button'
              onClick={copy_to_clipboard}
              title='Copy to clipboard'
            >
              {copy_success ? (
                <CheckIcon fontSize='small' />
              ) : (
                <ContentCopyOutlinedIcon fontSize='small' />
              )}
            </div>
          </div>
        </div>

        <div className='error_actions'>
          <div className='league_button reset_button' onClick={reload_page}>
            Reload Page
          </div>
        </div>
      </div>
    </div>
  )
}

ErrorView.propTypes = {
  error: PropTypes.object,
  info: PropTypes.object
}

export default ErrorView
