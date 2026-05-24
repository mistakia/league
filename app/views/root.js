/* global IS_DEV, APP_VERSION */
import React from 'react'
import { Provider } from 'react-redux'
import { HistoryRouter as Router } from 'redux-first-history/rr6'
import Highcharts from 'highcharts'

import Bugsnag from '@bugsnag/js'
import BugsnagPluginReact from '@bugsnag/plugin-react'

import { store, history } from '@core/store.js'
import storeRegistry from '@core/store-registry'
import App from '@components/app'
import ErrorView from '@components/error-view'

storeRegistry.register(store)

// react-table imports highcharts/modules/exporting at module load (Highcharts 12
// self-composes), which would otherwise turn on the burger-menu export group on
// every chart in the app. Opt out globally; charts that want export tooling
// (e.g. analytical views) opt back in per-chart with exporting.enabled = true.
Highcharts.setOptions({
  chart: {
    style: {
      fontFamily: "'IBM Plex Mono', monospace"
    }
  },
  exporting: {
    enabled: false
  },
  credits: {
    enabled: false
  }
})

// Dual-write callback: forward Bugsnag events to /api/errors so they
// land in the unified signal queue during the retirement soak. Returns
// true so Bugsnag still delivers the event normally.
// keepalive: true caps body at ~64KB in Chromium and is unsupported in
// Firefox < 106; truncate the stack so oversized traces don't silently
// drop the report.
const KEEPALIVE_STACK_LIMIT = 16000

const truncate_stack = (stack) => {
  if (typeof stack !== 'string') return stack
  if (stack.length <= KEEPALIVE_STACK_LIMIT) return stack
  return (
    stack.slice(0, KEEPALIVE_STACK_LIMIT) +
    `\n...[truncated ${stack.length - KEEPALIVE_STACK_LIMIT} chars]`
  )
}

const dual_write_to_league_api = (event) => {
  try {
    const error = event?.originalError || event?.errors?.[0] || {}
    const raw_stack = error?.stack || event?.errors?.[0]?.stacktrace || null
    fetch('/api/errors', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({
        error: {
          message:
            error?.message || event?.errors?.[0]?.errorMessage || 'Unknown',
          stack: truncate_stack(raw_stack),
          name: error?.name || event?.errors?.[0]?.errorClass || 'Error'
        }
      })
    }).catch(() => {})
  } catch (_send_error) {
    // never let dual-write block Bugsnag delivery
  }
  return true
}

Bugsnag.start({
  apiKey: '183fca706d9f94c00a661167bf8cfc5d',
  autoDetectErrors: !IS_DEV,
  appVersion: APP_VERSION,
  plugins: [new BugsnagPluginReact()],
  enabledReleaseStages: ['production'],
  onError: dual_write_to_league_api
})

// Get Bugsnag's ErrorBoundary and configure it with our custom ErrorView
const ErrorBoundary = Bugsnag.getPlugin('react').createErrorBoundary(React)

const Root = () => (
  <ErrorBoundary FallbackComponent={ErrorView}>
    <Provider store={store}>
      <Router history={history}>
        <App />
      </Router>
    </Provider>
  </ErrorBoundary>
)

export default Root
