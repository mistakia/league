/* global IS_DEV, APP_VERSION */
import React from 'react'

const KEEPALIVE_STACK_LIMIT = 16000
const BUGSNAG_API_KEY = '183fca706d9f94c00a661167bf8cfc5d'

const truncate_stack = (stack) => {
  if (typeof stack !== 'string') return stack
  if (stack.length <= KEEPALIVE_STACK_LIMIT) return stack
  return (
    stack.slice(0, KEEPALIVE_STACK_LIMIT) +
    `\n...[truncated ${stack.length - KEEPALIVE_STACK_LIMIT} chars]`
  )
}

const post_to_league_api = (err, metadata) => {
  try {
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
        metadata
      })
    }).catch(() => {})
  } catch (_send_error) {
    // never let dual-write block
  }
}

const dual_write_on_error = (event) => {
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

let bugsnag_instance = null
let bugsnag_load_promise = null
const pending_notifies = []
const pending_user = { id: null, email: null, set: false }

const should_load_bugsnag = () =>
  typeof window !== 'undefined' && typeof IS_DEV !== 'undefined' && !IS_DEV

const load_bugsnag = () => {
  if (bugsnag_load_promise) return bugsnag_load_promise
  if (!should_load_bugsnag()) return Promise.resolve(null)
  bugsnag_load_promise = Promise.all([
    import(/* webpackChunkName: "vendor-bugsnag" */ '@bugsnag/js'),
    import(/* webpackChunkName: "vendor-bugsnag" */ '@bugsnag/plugin-react')
  ])
    .then(([{ default: Bugsnag }, { default: BugsnagPluginReact }]) => {
      Bugsnag.start({
        apiKey: BUGSNAG_API_KEY,
        autoDetectErrors: true,
        appVersion: APP_VERSION,
        plugins: [new BugsnagPluginReact()],
        enabledReleaseStages: ['production'],
        onError: dual_write_on_error
      })
      bugsnag_instance = Bugsnag
      if (pending_user.set) {
        Bugsnag.setUser(pending_user.id, pending_user.email)
      }
      for (const [err, cb] of pending_notifies) {
        Bugsnag.notify(err, cb)
      }
      pending_notifies.length = 0
      return Bugsnag
    })
    .catch(() => null)
  return bugsnag_load_promise
}

export const init_bugsnag = () => {
  if (!should_load_bugsnag()) return
  const kickoff = () => load_bugsnag()
  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(kickoff, { timeout: 3000 })
  } else {
    setTimeout(kickoff, 2000)
  }
}

export const notify = (err, cb) => {
  post_to_league_api(err)
  if (bugsnag_instance) {
    bugsnag_instance.notify(err, cb)
    return
  }
  if (should_load_bugsnag()) {
    pending_notifies.push([err, cb])
    load_bugsnag()
  }
}

export const set_user = (id, email) => {
  pending_user.id = id
  pending_user.email = email
  pending_user.set = true
  if (bugsnag_instance) bugsnag_instance.setUser(id, email)
}

export class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null }
  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }
  componentDidCatch(error, info) {
    post_to_league_api(error, { componentStack: info?.componentStack })
    if (bugsnag_instance) {
      bugsnag_instance.notify(error)
    } else if (should_load_bugsnag()) {
      pending_notifies.push([error, null])
      load_bugsnag()
    }
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
