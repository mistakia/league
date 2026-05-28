import debug from 'debug'

const log = debug('emit-signal')

// Posts a signal to the unified queue at ${BASE_API_URL}/api/signals/.
// No-ops gracefully when BASE_API_URL/BASE_SIGNAL_SECRET are unset so the
// caller never fails on emission. See user:text/base/signal-system.md and
// user:guideline/surface-pipeline-failures.md for the contract.
const emit_signal = async ({
  source,
  kind,
  severity,
  title,
  payload,
  dedup_key,
  forensic_link
}) => {
  const base_url = process.env.BASE_API_URL
  const secret = process.env.BASE_SIGNAL_SECRET
  if (!base_url || !secret) {
    log('BASE_API_URL/BASE_SIGNAL_SECRET unset; signal NOT emitted: %s', title)
    return
  }
  try {
    const response = await fetch(
      `${base_url.replace(/\/$/, '')}/api/signals/`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-signal-secret': secret
        },
        body: JSON.stringify({
          source,
          kind,
          severity,
          title,
          payload,
          dedup_key,
          forensic_link
        }),
        signal: AbortSignal.timeout(10000)
      }
    )
    if (!response.ok) {
      log('signal emit failed: %d %s', response.status, response.statusText)
    }
  } catch (err) {
    log('signal emit threw: %s', err.message)
  }
}

export default emit_signal
