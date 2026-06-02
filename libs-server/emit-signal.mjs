import crypto from 'crypto'
import { existsSync, readFileSync } from 'fs'
import debug from 'debug'

const log = debug('emit-signal')

const TOKEN_TTL_MS = 30 * 1000

const sign_machine_token = ({ slug, key_path }) => {
  if (!slug || !key_path || !existsSync(key_path)) return null
  const private_key = crypto.createPrivateKey(readFileSync(key_path, 'utf8'))
  const exp = Date.now() + TOKEN_TTL_MS
  const payload = `${slug}.${exp}`
  const sig = crypto.sign(null, Buffer.from(payload), private_key).toString('base64url')
  return `${payload}.${sig}`
}

// Posts a signal to the unified queue at ${BASE_API_URL}/api/signals/.
// No-ops gracefully when BASE_API_URL / BASE_MACHINE_SLUG / BASE_INSTANCE_KEY_FILE
// are unset so the caller never fails on emission. See
// user:text/base/signal-system.md and user:guideline/surface-pipeline-failures.md.
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
  const slug = process.env.BASE_MACHINE_SLUG
  const key_path = process.env.BASE_INSTANCE_KEY_FILE
  if (!base_url || !slug || !key_path) {
    log(
      'BASE_API_URL/BASE_MACHINE_SLUG/BASE_INSTANCE_KEY_FILE unset; signal NOT emitted: %s',
      title
    )
    return
  }
  let token
  try {
    token = sign_machine_token({ slug, key_path })
  } catch (err) {
    log('machine token sign failed: %s; signal NOT emitted: %s', err.message, title)
    return
  }
  if (!token) {
    log('machine token unavailable (missing key file); signal NOT emitted: %s', title)
    return
  }
  try {
    const response = await fetch(
      `${base_url.replace(/\/$/, '')}/api/signals/`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Machine ${token}`
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
