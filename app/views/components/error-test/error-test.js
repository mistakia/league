import React, { useState } from 'react'

import PageLayout from '@layouts/page'
import './error-test.styl'
import '@styles/button.styl'

const ErrorTest = () => {
  const [should_crash, set_should_crash] = useState(false)

  if (should_crash) {
    // This will trigger the Bugsnag ErrorBoundary
    throw new Error('This is a test error from ErrorTest component')
  }

  const crash_on_render = () => {
    set_should_crash(true)
  }

  const content = (
    <div className='error_test_container'>
      <h2>Error Boundary Test Page</h2>
      <p>
        This page allows you to test the Bugsnag ErrorBoundary with our custom
        FallbackComponent.
      </p>

      <div className='error_test_buttons'>
        <div className='league_button error_button' onClick={crash_on_render}>
          Crash on Render
        </div>
      </div>
    </div>
  )

  return <PageLayout body={content} scroll />
}

export default ErrorTest
