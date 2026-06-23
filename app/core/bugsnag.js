/* global IS_DEV */
import React from 'react'
import PropTypes from 'prop-types'

// Client error reporting.
//
// Errors are POSTed to /api/errors, which symbolicates the stack against the
// build's private sourcemaps and emits a log_error signal to the base signal
// queue. This replaced Bugsnag on 2026-06-23 once server-side symbolication
// reached parity; the file name is retained to avoid churning import sites.
//
// Capture surfaces (parity with Bugsnag autoDetectErrors):
//   - React render/lifecycle errors via ErrorBoundary.componentDidCatch
//   - uncaught errors via window 'error'
//   - unhandled promise rejections via window 'unhandledrejection'

const KEEPALIVE_STACK_LIMIT = 16000

const truncate_stack = (stack) => {
  if (typeof stack !== 'string') return stack
  if (stack.length <= KEEPALIVE_STACK_LIMIT) return stack
  return (
    stack.slice(0, KEEPALIVE_STACK_LIMIT) +
    `\n...[truncated ${stack.length - KEEPALIVE_STACK_LIMIT} chars]`
  )
}

// Only auto-report uncaught errors/rejections in production, matching the
// release-stage gate Bugsnag previously enforced. The ErrorBoundary path
// reports unconditionally (its dual-write was always on).
const should_report = () =>
  typeof window !== 'undefined' && typeof IS_DEV !== 'undefined' && !IS_DEV

let current_user = null

const post_to_league_api = (err, metadata) => {
  try {
    const enriched =
      current_user && typeof current_user === 'object'
        ? { ...(metadata || {}), user: current_user }
        : metadata
    fetch('/api/errors', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({
        error: {
          message: err?.message || 'Unknown',
          stack: truncate_stack(err?.stack),
          name: err?.name || 'Error'
        },
        metadata: enriched
      })
    }).catch(() => {})
  } catch (_send_error) {
    // never let error reporting throw
  }
}

export const init_error_reporting = () => {
  if (typeof window === 'undefined' || !should_report()) return

  window.addEventListener('error', (event) => {
    // Ignore resource-load errors (img/script 404s) — they target the element,
    // not the window, and carry no Error object.
    if (event?.target && event.target !== window) return
    const error =
      event?.error instanceof Error
        ? event.error
        : new Error(event?.message || 'Uncaught error')
    post_to_league_api(error, { handler: 'window.onerror' })
  })

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event?.reason
    const error =
      reason instanceof Error
        ? reason
        : new Error(
            typeof reason === 'string' ? reason : 'Unhandled promise rejection'
          )
    post_to_league_api(error, { handler: 'unhandledrejection' })
  })
}

export const notify = (err, metadata) => {
  post_to_league_api(err, metadata)
}

export const set_user = (id, email) => {
  current_user =
    id != null || email != null
      ? { id: id ?? null, email: email ?? null }
      : null
}

export class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null }
  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    post_to_league_api(error, { componentStack: info?.componentStack })
  }

  render() {
    if (this.state.hasError) {
      const Fallback = this.props.FallbackComponent
      return Fallback
        ? React.createElement(Fallback, { error: this.state.error })
        : null
    }
    return this.props.children
  }
}

ErrorBoundary.propTypes = {
  FallbackComponent: PropTypes.elementType,
  children: PropTypes.node
}
