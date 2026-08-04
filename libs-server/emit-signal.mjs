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
  const sig = crypto
    .sign(null, Buffer.from(payload), private_key)
    .toString('base64url')
  return `${payload}.${sig}`
}

// Shared transport for both arms below. Returns null rather than throwing on
// every failure mode -- an oracle that can take down the run it instruments is
// worse than one that is mute, and the mute case is logged.
const post_to_signals_api = async ({ path, body, description }) => {
  const base_url = process.env.BASE_API_URL
  const slug = process.env.BASE_MACHINE_SLUG
  const key_path = process.env.BASE_INSTANCE_KEY_FILE
  if (!base_url || !slug || !key_path) {
    log(
      'BASE_API_URL/BASE_MACHINE_SLUG/BASE_INSTANCE_KEY_FILE unset; %s NOT sent: %s',
      path,
      description
    )
    return null
  }
  let token
  try {
    token = sign_machine_token({ slug, key_path })
  } catch (err) {
    log(
      'machine token sign failed: %s; %s NOT sent: %s',
      err.message,
      path,
      description
    )
    return null
  }
  if (!token) {
    log(
      'machine token unavailable (missing key file); %s NOT sent: %s',
      path,
      description
    )
    return null
  }
  try {
    const response = await fetch(`${base_url.replace(/\/$/, '')}${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Machine ${token}`
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000)
    })
    if (!response.ok) {
      log('%s failed: %d %s', path, response.status, response.statusText)
      return null
    }
    return await response.json()
  } catch (err) {
    log('%s threw: %s', path, err.message)
    return null
  }
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
}) =>
  post_to_signals_api({
    path: '/api/signals/',
    description: title,
    body: {
      source,
      kind,
      severity,
      title,
      payload,
      dedup_key,
      forensic_link
    }
  })

// Closes the open signal carrying `dedup_key`, if one exists. This module had
// an emit arm and no resolve arm, so every condition-shaped signal a league
// importer raised stayed open until a human closed it by hand -- which makes a
// recurring detector indistinguishable from a stuck one after its first firing.
//
// The route is a cheap 200 no-op when nothing is open (`{ resolved: false,
// reason: 'no_open_signal' }`), so it is safe to call on every healthy run and
// callers should do exactly that. Gate it on the OBSERVED healthy condition,
// never on an in-process "did I emit" latch: pm2 reloads these workers on every
// deploy, and a latch would strand the open signal permanently.
//
// `host` is deliberately omitted to match the emit arm above, which also sends
// none -- the resolve lookup scopes on the stored COALESCE(run_host, host), so
// the two must agree or the resolve silently matches nothing.
export const resolve_signal = async ({ dedup_key, resolution_note }) => {
  if (!dedup_key) {
    log('resolve_signal called with no dedup_key')
    return null
  }
  return post_to_signals_api({
    path: '/api/signals/resolve',
    description: dedup_key,
    body: {
      dedup_key,
      resolution_note: resolution_note || 'auto-resolved'
    }
  })
}

export default emit_signal
