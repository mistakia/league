import crypto from 'crypto'
import fs from 'fs'

import ed25519 from '@trashman/ed25519-blake2b'

// The league-side client for base's managed session rail.
//
// This is the ONE seam between the generation queue and the agent that answers
// it: league claims a job from its own durable table, and this module turns
// that job into a container session on base's rail. Everything the agent does
// after that happens inside a tenant container league does not operate.
//
// WHY LEAGUE HOLDS THE IDENTITY KEY AND THE CONTAINER DOES NOT. The obvious
// alternative -- mount the private key into the tenant so the AGENT writes its
// own result back -- puts a write-capable credential inside the sandbox whose
// whole design is that it holds only a read-only database role. League already
// runs with production credentials and a sops-encrypted config, so the key
// costs nothing there and buys a door that does not exist in the container.
//
// THE SIGNING TRAP, and it fails silently. Base derives keys and signs with
// Ed25519-Blake2b, not the SHA-512 Ed25519 that node:crypto implements. The
// same 32-byte seed yields a DIFFERENT public key under the two schemes and
// nothing warns you: a SHA-512 library produces a well-formed signature that
// base rejects with `invalid signature`, which reads like a malformed request
// rather than a wrong curve. Hence the explicit dependency rather than
// node:crypto's ed25519.
//
// THE SECOND TRAP: the server hashes `JSON.stringify(data)` and signs the HASH,
// not the raw bytes. A serializer that pretty-prints, or a signer that signs
// the payload directly, fails with the same `invalid signature`.
//
// THE THIRD TRAP, and it is the one that actually shipped broken: the RAW
// `@trashman/ed25519-blake2b` `sign` takes THREE arguments -- message, secret
// key, PUBLIC KEY -- and throws `public key must be a buffer or hex string` when
// the third is omitted. Base's own `libs-server/crypto/ed25519-blake2b.mjs`
// wrapper takes the same three and IGNORES the third, so code copied from base's
// call sites signs happily there and throws here. The throw surfaces as
// `dispatch_failed` rather than as anything naming a key, which sends the reader
// to the network and to base's auth rather than to this line. Every dispatch
// failed this way until 2026-09-03; the path had only ever been exercised with
// base's own tooling, never through this module.

const SESSION_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000
// Re-mint an hour before expiry rather than on rejection. A token that expires
// mid-drain would fail one job for a reason that has nothing to do with it.
const SESSION_TOKEN_REFRESH_MARGIN_MS = 60 * 60 * 1000
const REQUEST_TIMEOUT_MS = 30 * 1000

export class BaseSessionError extends Error {
  constructor(code, message, detail = {}) {
    super(message)
    this.name = 'BaseSessionError'
    this.code = code
    Object.assign(this, detail)
  }
}

/**
 * Where the generation identity's private key lives on this host.
 *
 * A FILE PATH, never a value in the environment. An env value is readable from
 * a process listing and from any container inspection, and this key mints
 * sessions on base's rail.
 *
 * @returns {string}
 */
export const resolve_identity_key_path = () =>
  process.env.LEAGUE_GENERATION_IDENTITY_KEY_FILE ||
  '/root/.league-data-view-generation-identity.key'

/**
 * Read the 32-byte seed, refusing by NAME on every way it can be wrong.
 *
 * A blank or truncated seed reaches base as `invalid signature`, which names
 * neither the file nor the length -- so every failure here is caught at the
 * source instead.
 *
 * @returns {Buffer}
 */
const read_identity_seed = () => {
  const path = resolve_identity_key_path()
  let raw
  try {
    raw = fs.readFileSync(path, 'utf8').trim()
  } catch (error) {
    throw new BaseSessionError(
      'identity_key_unreadable',
      `the generation identity key at ${path} could not be read: ${error.message}`
    )
  }
  if (!/^[0-9a-fA-F]{64}$/.test(raw)) {
    throw new BaseSessionError(
      'identity_key_malformed',
      `the generation identity key at ${path} is not 64 hex characters`
    )
  }
  return Buffer.from(raw, 'hex')
}

/**
 * Build the signed body base's session route expects.
 *
 * Separated from the fetch ON PURPOSE, so the three signing traps at the top of
 * this file are exercisable without a network and without base being up. All
 * three fail in ways that surface far from the signing line -- two as base's
 * `invalid signature`, and the third as a local throw filed under
 * `dispatch_failed` -- so a test that cannot reach this code cannot see any of
 * them.
 *
 * @param {Buffer} seed - the 32-byte identity seed
 * @returns {{data: object, signature: string}}
 */
export const build_session_request = (seed) => {
  const public_key = Buffer.from(ed25519.publicKey(seed))
  const data = {
    user_public_key: public_key.toString('hex'),
    timestamp: Date.now(),
    nonce: crypto.randomUUID()
  }
  // The HASH, not the payload -- see the second trap at the top of this file.
  // And the PUBLIC KEY as the third argument -- see the third trap, which is
  // what made every dispatch fail before 2026-09-03.
  const signature = Buffer.from(
    ed25519.sign(ed25519.hash(JSON.stringify(data)), seed, public_key)
  ).toString('hex')
  return { data, signature }
}

let cached_token = null
let cached_token_expires_at = 0

/**
 * Mint (or reuse) a base session token for the generation identity.
 *
 * @param {object} [params]
 * @param {boolean} [params.force] - ignore the cache; used after a 401
 * @returns {Promise<string>}
 */
export const get_base_session_token = async ({ force = false } = {}) => {
  if (
    !force &&
    cached_token &&
    Date.now() < cached_token_expires_at - SESSION_TOKEN_REFRESH_MARGIN_MS
  ) {
    return cached_token
  }

  const base_url = process.env.BASE_API_URL
  if (!base_url) {
    throw new BaseSessionError(
      'base_api_url_unset',
      'BASE_API_URL is not set, so there is no base rail to dispatch a generation session onto'
    )
  }

  const { data, signature } = build_session_request(read_identity_seed())

  const response = await fetch(
    `${base_url.replace(/\/$/, '')}/api/users/session`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data, signature }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    }
  )

  if (!response.ok) {
    const body = await response.text()
    throw new BaseSessionError(
      'session_mint_failed',
      `base refused a session token with ${response.status}: ${body.slice(0, 200)}`,
      { status: response.status }
    )
  }

  const { token } = await response.json()
  if (!token) {
    throw new BaseSessionError(
      'session_mint_empty',
      'base returned a session response carrying no token'
    )
  }

  cached_token = token
  cached_token_expires_at = Date.now() + SESSION_TOKEN_TTL_MS
  return token
}

/**
 * Drop the cached token. Exported for the spec, and called on a 401.
 */
export const reset_base_session_token = () => {
  cached_token = null
  cached_token_expires_at = 0
}

/**
 * The prompt the container agent receives.
 *
 * It carries the instruction and NOTHING procedural. How to build a view, which
 * tools exist and how to invoke them are the profile's `append_system_prompt`
 * and the checkout's AGENT_INSTRUCTIONS -- restating any of it here would give
 * the two a way to drift, which is the same reason the profile routes to the
 * module rather than copying it.
 *
 * @param {object} params
 * @param {string} params.instruction
 * @param {object|null} [params.input_table_state] - the edit case
 * @returns {string}
 */
export const build_generation_prompt = ({
  instruction,
  input_table_state = null
}) => {
  const lines = [instruction.trim()]
  if (input_table_state) {
    lines.push(
      '',
      'This is an EDIT. The view the user is currently looking at follows; return a complete replacement, not a patch.',
      JSON.stringify(input_table_state)
    )
  }
  return lines.join('\n')
}

/**
 * Dispatch one generation job onto base's session rail.
 *
 * ONE POST, and it RETURNS BEFORE THE AGENT RUNS. create-session enqueues onto
 * base's durable thread-creation queue and answers with a thread id and a job
 * id; the container session starts after that. So this call succeeding means
 * the work was accepted, never that a view was produced -- which is exactly why
 * the league-side job row has its own `running` state and its own deadline.
 *
 * `thread_config_profile` is passed EXPLICITLY rather than left to the
 * identity's default. The default is correct today, and naming it means a later
 * identity gaining a second allowed profile cannot silently move generation
 * onto the other one.
 *
 * @param {object} params
 * @param {string} params.generation_id - league's own key, carried as the slug
 * @param {string} params.instruction
 * @param {object|null} [params.input_table_state]
 * @param {(url: string, init: object) => Promise<Response>} [params.fetch_impl]
 *   - injected by the spec
 * @returns {Promise<{thread_id: string, job_id: string}>}
 */
export const dispatch_generation_session = async ({
  generation_id,
  instruction,
  input_table_state = null,
  fetch_impl = fetch
}) => {
  const base_url = process.env.BASE_API_URL
  if (!base_url) {
    throw new BaseSessionError(
      'base_api_url_unset',
      'BASE_API_URL is not set, so there is no base rail to dispatch a generation session onto'
    )
  }

  const body = JSON.stringify({
    prompt: build_generation_prompt({ instruction, input_table_state }),
    working_directory: 'user:repository/active/league',
    thread_config_profile: 'league-data-view-generation',
    // Base requires a client-minted uuid v4 and 400s without one.
    thread_id: crypto.randomUUID(),
    prompt_correlation_id: crypto.randomUUID(),
    // Human-facing only. The league-side key stays generation_id; this just
    // makes a pane findable while a run is in flight.
    session_slug: `data-view-generation-${generation_id.slice(0, 8)}`
  })

  const post = async (token) =>
    fetch_impl(`${base_url.replace(/\/$/, '')}/api/threads/create-session`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    })

  let response = await post(await get_base_session_token())
  // ONE retry, and only on 401. A rotated identity key invalidates every token
  // base ever issued, so a cached one outlives its identity -- and the failure
  // is indistinguishable from a bad request until you re-mint.
  if (response.status === 401) {
    reset_base_session_token()
    response = await post(await get_base_session_token({ force: true }))
  }

  if (!response.ok) {
    const text = await response.text()
    // Named separately because each sends the operator somewhere different: a
    // 429 is the profile's own concurrency ceiling and clears on its own, while
    // a 503 means base could not READ the container's session count -- which is
    // what a create-session posted to the wrong host answers, since the count
    // is a local `docker top`.
    const code =
      response.status === 429
        ? 'base_capacity_reached'
        : response.status === 503
          ? 'base_container_unreadable'
          : 'base_dispatch_failed'
    throw new BaseSessionError(
      code,
      `base refused the generation session with ${response.status}: ${text.slice(0, 300)}`,
      { status: response.status }
    )
  }

  const { thread_id, job_id } = await response.json()
  if (!thread_id) {
    throw new BaseSessionError(
      'base_dispatch_empty',
      'base accepted the generation session but returned no thread_id'
    )
  }

  return { thread_id, job_id }
}

/**
 * Tear down the agent session behind a finished generation.
 *
 * A generation is one-shot -- league sends one instruction and there is never a
 * second turn -- but base launches every session as an interactive REPL, so the
 * agent sits at an idle prompt after answering and nothing reclaims it. Base
 * deliberately retired its headless one-shot path, so asking the session to exit
 * itself is not available; an external teardown is the whole remaining lever.
 *
 * Two costs make this worth a network call rather than a cleanup someone runs
 * later. An idle REPL holds a container slot the next run needs, and -- measured
 * 2026-09-03 -- an EXPIRED job leaves its agent running: the deadline sweep
 * closes league's row while the session keeps thinking, spending GPU and tokens
 * on an answer the delivery door will refuse.
 *
 * Idempotent, and deliberately never throws. This runs after a job has already
 * reached its terminal state, so a failure here must not change the answer the
 * user gets; it reports and the caller records the attempt either way. The
 * generation identity OWNS the threads it creates, which is what authorizes the
 * call.
 *
 * @param {object} params
 * @param {string} params.thread_id
 * @param {(url: string, init: object) => Promise<Response>} [params.fetch_impl]
 * @returns {Promise<{killed: boolean, reason: string}>}
 */
export const kill_generation_session = async ({
  thread_id,
  fetch_impl = fetch
}) => {
  const base_url = process.env.BASE_API_URL
  if (!base_url) {
    return { killed: false, reason: 'BASE_API_URL is not set' }
  }

  const post = async (token) =>
    fetch_impl(`${base_url.replace(/\/$/, '')}/api/repl/${thread_id}/kill`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: '{}',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    })

  try {
    let response = await post(await get_base_session_token())
    // Same 401 retry as dispatch, for the same reason: a rotated identity key
    // invalidates every token base ever issued, and a cached one outlives it.
    if (response.status === 401) {
      reset_base_session_token()
      response = await post(await get_base_session_token({ force: true }))
    }
    if (!response.ok) {
      const text = await response.text()
      return {
        killed: false,
        reason: `base answered ${response.status}: ${text.slice(0, 200)}`
      }
    }
    return { killed: true, reason: 'base tore the session down' }
  } catch (error) {
    return { killed: false, reason: error.message }
  }
}

export default {
  BaseSessionError,
  build_generation_prompt,
  build_session_request,
  dispatch_generation_session,
  get_base_session_token,
  kill_generation_session,
  reset_base_session_token,
  resolve_identity_key_path
}
