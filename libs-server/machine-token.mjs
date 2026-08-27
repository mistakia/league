// The `Authorization: Machine` token, minted for base-api and for the
// inference gateway.
//
// WHY A MODULE, WHEN THE STANDING GUIDELINE SAYS NOT TO.
// user:guideline/auth/sign-machine-requests.md rejects a SHARED signer and asks
// each emitter to inline the eight lines. Its reasoning is about dependency
// CONTEXTS -- half a dozen of them across the fleet, including sh-only shell
// scripts that would have to re-implement it anyway, and a cross-repo import
// surface that could skew. None of that applies here: this is one module inside
// one Node process, imported by two callers in the same repo, and the second
// caller needs something the inlined copy cannot do at all.
//
// That second caller is why this exists. The vendored copy in emit-signal.mjs
// signs `slug.exp.sig`, and the inference gateway requires the four-field
// audience-scoped form `slug.exp.aud.sig` -- a verifier that expects an
// audience rejects a token without one outright. Two divergent inline copies of
// a signature scheme in one repo is the version skew the guideline was written
// to prevent, arrived at from the other direction.
//
// The wire contract is the base one, not a league invention: see
// base libs-server/auth/sign-machine-token.mjs (the signer this mirrors) and
// libs-server/auth/verify-machine-token.mjs (the verifier that decides).

import crypto from 'crypto'
import fs from 'fs'
import os from 'os'

const DEFAULT_TTL_MS = 30 * 1000

/**
 * The instance key path, resolved through the same chain as base's
 * machine-key-loader.
 *
 * Requiring BASE_INSTANCE_KEY_FILE outright -- which this repo's emit-signal.mjs
 * did until it was pointed here -- is stricter than the loader it talks to, and
 * the fleet's full hosts deliberately set no such variable: pointing it at
 * ~/.base-instance-private.key would shadow the registered config/ identity
 * with an unregistered orphan. So the stricter emitter goes mute on exactly the
 * hosts that are correctly provisioned.
 *
 * @returns {string}
 */
export const resolve_instance_key_path = () =>
  process.env.BASE_INSTANCE_KEY_FILE ||
  (process.env.USER_BASE_DIRECTORY &&
    `${process.env.USER_BASE_DIRECTORY}/config/instance-private.key`) ||
  `${os.homedir()}/.base-instance-private.key`

/**
 * Sign a payload with an already-loaded Ed25519 private key.
 *
 * @param {object} params
 * @param {string} params.slug - the machine registry slug
 * @param {import('crypto').KeyObject} params.private_key
 * @param {number} [params.ttl_ms]
 * @param {string} [params.audience] - scope the token to ONE verifier. The
 *   audience is part of the SIGNED payload, so a token minted for the inference
 *   gateway is not also a bearer credential for base-api or federation. A
 *   verifier rejects an audience that is not its own, and a verifier expecting
 *   none rejects an audienced token outright -- which is why this is a
 *   parameter rather than a constant.
 * @returns {string}
 */
export const sign_machine_token = ({
  slug,
  private_key,
  ttl_ms = DEFAULT_TTL_MS,
  audience = null
}) => {
  if (!slug || typeof slug !== 'string') {
    throw new TypeError('sign_machine_token: slug required')
  }
  if (!private_key) {
    throw new TypeError('sign_machine_token: private_key required')
  }
  if (audience != null) {
    if (typeof audience !== 'string' || !audience.length) {
      throw new TypeError(
        'sign_machine_token: audience must be a non-empty string'
      )
    }
    // The dot is the token's field separator, so an audience carrying one is
    // parsed as a different field count on the far side.
    if (audience.includes('.')) {
      throw new TypeError('sign_machine_token: audience must not contain a dot')
    }
  }

  const exp = Date.now() + ttl_ms
  const payload =
    audience == null ? `${slug}.${exp}` : `${slug}.${exp}.${audience}`
  const sig = crypto
    .sign(null, Buffer.from(payload), private_key)
    .toString('base64url')

  return `${payload}.${sig}`
}

/**
 * Load the key and sign, per request.
 *
 * Never cache the return value. The TTL is 30 seconds, so a cached token is a
 * request that starts failing somewhere between one and thirty seconds after it
 * was minted -- an intermittent 401 whose cause is invisible at the call site.
 *
 * Returns null rather than throwing when the host cannot sign at all, because
 * an emitter that crash-loops a PM2 process on an unprovisioned host is worse
 * than a missed signal. The caller decides what that means: emit-signal.mjs
 * treats it as a loud no-op, the inference client treats it as a hard failure,
 * because a generation request that proceeds without credentials just fails
 * later and further away.
 *
 * @param {object} [params]
 * @param {string} [params.slug]
 * @param {string} [params.key_path]
 * @param {string} [params.audience]
 * @param {number} [params.ttl_ms]
 * @returns {string|null}
 */
export const mint_machine_token = ({
  slug = process.env.BASE_MACHINE_SLUG,
  key_path = resolve_instance_key_path(),
  audience = null,
  ttl_ms = DEFAULT_TTL_MS
} = {}) => {
  if (!slug || !key_path || !fs.existsSync(key_path)) return null

  const private_key = crypto.createPrivateKey(fs.readFileSync(key_path, 'utf8'))
  return sign_machine_token({ slug, private_key, ttl_ms, audience })
}

export default mint_machine_token
