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

// CSS/JS chunk-load failures are a stale-client condition, not a server bug.
// After a deploy ships new contenthashed chunk filenames, clients still running
// the previous index.html request the now-deleted old hashes and throw a
// ChunkLoadError. This is expected post-deploy churn — e.g. the 2026-06-26
// 12:24-12:29 burst across CSS chunks 6900 (vendor-react-table) and 5295 after
// a react-table bump rehashed those chunks — and should NOT surface as
// log_error signals. Instead we recover the stale client with a single forced
// reload (which pulls the fresh index.html and the current chunk hashes); only
// if the error RECURS within a short window after that reload — a genuinely
// broken deploy whose chunks are missing for everyone — do we report it.
const CHUNK_RELOAD_KEY = 'xo_chunk_reload_at'
const CHUNK_RELOAD_WINDOW_MS = 60 * 1000

const is_chunk_load_error = (err) => {
  if (!err) return false
  if (err.name === 'ChunkLoadError') return true
  const message = err.message || ''
  return /Loading (?:CSS )?chunk\s+\S+\s+failed/i.test(message)
}

// Returns true if the caller should SKIP reporting (a recovery reload was
// triggered); false if the error recurred post-reload and should be reported as
// a genuine break. Never throws — sessionStorage/reload access is guarded.
const recover_from_chunk_error = () => {
  let last = 0
  try {
    last = Number(window.sessionStorage.getItem(CHUNK_RELOAD_KEY)) || 0
  } catch (_e) {
    // sessionStorage unavailable (privacy mode) — proceed without a guard.
  }
  const now = Date.now()
  if (now - last < CHUNK_RELOAD_WINDOW_MS) {
    // Already reloaded recently and the chunk still fails — genuine break.
    return false
  }
  try {
    window.sessionStorage.setItem(CHUNK_RELOAD_KEY, String(now))
  } catch (_e) {
    // ignore — proceed to reload regardless
  }
  try {
    window.location.reload()
  } catch (_e) {
    // ignore — if reload is unavailable, fall through; nothing else to do
  }
  return true
}

// Expected client-side 4xx responses — a stale/malformed saved data_view_id,
// an expired token, a not-found resource — are application flow already
// surfaced to the user via a notification, not server bugs, so they must NOT
// emit a log_error signal. dispatch_fetch (api/service.js) attaches the failed
// Response as err.response on the non-2xx branch, so the status is readable
// here. 5xx, network, and uncaught JS errors carry no 4xx response and still
// report.
const is_expected_client_error = (err) => {
  const status = err?.response?.status
  return typeof status === 'number' && status >= 400 && status < 500
}

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
    // Suppress expected post-deploy chunk-load churn (see is_chunk_load_error):
    // recover the stale client with a reload instead of emitting a signal.
    if (is_chunk_load_error(err) && recover_from_chunk_error()) return
    // Drop expected client 4xx (e.g. invalid/stale saved data_view_id) before
    // it becomes log_error noise — the user already saw a notification.
    if (is_expected_client_error(err)) return
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
          name: err?.name || 'Error',
          // Target URL of a failed fetch, attached in api/service.js so a
          // network-layer error is triageable to a specific endpoint.
          request_url: err?.request_url || null
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
