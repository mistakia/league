import debug from 'debug'

import {
  mint_machine_token,
  resolve_instance_key_path
} from '#libs-server/machine-token.mjs'

const log = debug('emit-signal')

// Shared transport for both arms below. Returns null rather than throwing on
// every failure mode -- an oracle that can take down the run it instruments is
// worse than one that is mute, and the mute case is logged.
const post_to_signals_api = async ({ path, body, description }) => {
  const base_url = process.env.BASE_API_URL
  const slug = process.env.BASE_MACHINE_SLUG
  // Resolved rather than demanded. This module required BASE_INSTANCE_KEY_FILE
  // outright until 2026-08-27, which is stricter than the loader base-api
  // verifies against -- and the fleet's full hosts deliberately set no such
  // variable, so the strictness went mute on exactly the correctly-provisioned
  // hosts. See user:guideline/auth/sign-machine-requests.md.
  const key_path = resolve_instance_key_path()
  if (!base_url || !slug) {
    log(
      'BASE_API_URL/BASE_MACHINE_SLUG unset; %s NOT sent: %s',
      path,
      description
    )
    return null
  }
  let token
  try {
    token = mint_machine_token({ slug, key_path })
  } catch (err) {
    // Loud on stderr per user:guideline/auth/sign-machine-requests.md: a signer
    // that cannot sign must never no-op silently.
    console.error(
      `[emit-signal] machine token sign failed: ${err.message}; ${path} NOT sent: ${description}`
    )
    return null
  }
  if (!token) {
    console.error(
      `[emit-signal] machine token unavailable (missing key file); ${path} NOT sent: ${description}`
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
      // console.error, not log: this module's output IS the audit trail for
      // whether a condition reached the queue, and the deployed server.mjs sets
      // no DEBUG at all, so every `log` line here is dark in production. A
      // signal that silently fails to send is indistinguishable from a healthy
      // system -- the exact shape user:guideline/surface-pipeline-failures.md
      // exists to prevent.
      console.error(
        `[emit-signal] ${path} failed: ${response.status} ${response.statusText}: ${description}`
      )
      return null
    }
    return await response.json()
  } catch (err) {
    console.error(`[emit-signal] ${path} threw: ${err.message}: ${description}`)
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
  const result = await post_to_signals_api({
    path: '/api/signals/resolve',
    description: dedup_key,
    body: {
      dedup_key,
      resolution_note: resolution_note || 'auto-resolved'
    }
  })

  // The HTTP resolve path answers 200 with `{ resolved: false }` on a scope
  // miss -- the non-zero exit documented in user:text/base/signal-system.md is
  // the `base signal close` CLI only. So a close that resolved NOTHING is
  // indistinguishable from a successful one to a caller that ignores the body,
  // and an open signal nobody can close reads as a stuck detector forever.
  //
  // `resolved: false` with an empty `other_scopes` is the ordinary healthy case
  // (nothing was open, the condition never fired) and stays quiet. `resolved:
  // false` WITH other_scopes is the real defect: the key is open somewhere this
  // close cannot reach, which means emit and resolve disagree about host scope.
  if (result && result.resolved === false && result.other_scopes?.length) {
    console.error(
      `[emit-signal] resolve matched nothing for ${dedup_key}, but it is open at another host scope: ${JSON.stringify(
        result.other_scopes
      )}. Emit and resolve disagree about scope; the open signal cannot self-close.`
    )
  }

  return result
}

export default emit_signal
