import fs from 'fs'
import { spawnSync } from 'child_process'
import debug from 'debug'

import is_main from './is-main.mjs'
import AuthenticatedApiClient from './external-fantasy-leagues/utils/authenticated-api-client.mjs'

// Value-free ESPN session auth for the teflonleague service account.
//
// ESPN private-league access is cookie-based (espn_s2 + SWID). Those cookies are
// the SESSION, derived by logging into the account. Disney's login is now gated
// behind an Arkose (FunCaptcha) challenge + email 2FA and the credential fields
// live in a cross-origin iframe, so headless username/password login no longer
// works — the session is established in an operator-attended stealth-browser
// re-auth (scripts/espn-signin.mjs) that persists a CloakBrowser profile.
//
// This module is the AUTOMATED back half of that pipeline: it extracts a fresh
// espn_s2 + SWID from the persisted `espn` profile via the cloak-browser CLI
// (which handles the _stealth-browser sudo/containment split), and hands callers
// an authenticated client or a mode-0600 cookie file. It never handles the
// account password. When the profile's session has expired it raises a
// REAUTH_REQUIRED error pointing the operator back to the re-auth script.
//
// Value-free discipline: the cookie jar (which carries the session secret) is
// captured over a pipe and parsed in memory — never logged or written to stdout.
// The preferred interface is an authenticated client that carries the cookie in
// its request headers; callers that need the raw value get it only via a 0600
// file.
const log = debug('espn:auth')

// The persistent CloakBrowser profile that holds the authenticated ESPN session.
// Registered in user-base data/browser/profiles.json; re-authed by
// scripts/espn-signin.mjs.
export const ESPN_PROFILE = 'espn'

/**
 * Error raised when the ESPN profile has no live session and an operator-attended
 * re-auth is required. Carries reauth_required so callers/wrappers can classify
 * it (mirrors the finance-vendor REAUTH_REQUIRED lifecycle).
 */
export class EspnReauthRequiredError extends Error {
  constructor(message) {
    super(message)
    this.name = 'EspnReauthRequiredError'
    this.reauth_required = true
    this.code = 'REAUTH_REQUIRED'
  }
}

/**
 * Format the ESPN Cookie header from a derived cookie pair. Pure.
 * @param {{ espn_s2: string, swid: string }} cookies
 * @returns {string} ready-to-use Cookie header value
 */
export const build_espn_cookie_header = ({ espn_s2, swid }) => {
  if (!espn_s2 || !swid) {
    throw new Error('both espn_s2 and swid are required')
  }
  return `s2=${espn_s2}; SWID=${swid}`
}

/**
 * Build an HTTP client authenticated with the given ESPN cookie pair. Pure (no
 * network): the cookie is carried in the client's request headers.
 * @param {{ espn_s2: string, swid: string }} cookies
 * @param {Object} [options]
 * @param {string} [options.base_url] - base URL for the client
 * @returns {AuthenticatedApiClient}
 */
export const build_espn_client = (cookies, { base_url } = {}) => {
  const client = new AuthenticatedApiClient({ base_url })
  client.set_authentication(cookies, 'cookie_based')
  return client
}

/**
 * Extract the espn_s2 + SWID pair from a cloak-browser get-cookies JSON payload.
 * Pure — separated so it is unit-testable without spawning a browser.
 * @param {Array<{name: string, value: string}>} cookies
 * @returns {{ espn_s2: string, swid: string }}
 * @throws {EspnReauthRequiredError} if either session cookie is absent/empty
 */
export const extract_espn_cookies = (cookies) => {
  const by_name = Object.fromEntries((cookies || []).map((c) => [c.name, c]))
  const espn_s2 = by_name.espn_s2 && by_name.espn_s2.value
  const swid = by_name.SWID && by_name.SWID.value
  if (!espn_s2 || !swid) {
    throw new EspnReauthRequiredError(
      `ESPN session cookies missing from CloakBrowser profile "${ESPN_PROFILE}" — ` +
        'REAUTH_REQUIRED: run scripts/espn-signin.mjs to re-establish the session'
    )
  }
  return { espn_s2, swid }
}

/**
 * Run a cloak-browser subcommand, returning stdout. Value-free: stdout (which for
 * get-cookies carries the session secret) is captured to a buffer and returned to
 * the caller for in-memory parsing — never logged here.
 * @private
 */
const run_cloak_browser = (cb_args) => {
  const result = spawnSync('cloak-browser', cb_args, {
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024
  })
  if (result.error) {
    if (result.error.code === 'ENOENT') {
      throw new Error('cloak-browser not found on PATH')
    }
    throw new Error(`cloak-browser invocation failed: ${result.error.message}`)
  }
  if (result.status !== 0) {
    throw new Error(
      `cloak-browser ${cb_args[0]} failed (exit ${result.status}): ${(result.stderr || '').trim()}`
    )
  }
  return result.stdout
}

/**
 * Derive a fresh ESPN cookie pair from the persisted `espn` CloakBrowser profile.
 * Opens the profile headless, exports the cookie jar, and closes it — value-free
 * throughout. No account password is handled: the session was established by the
 * attended re-auth (scripts/espn-signin.mjs).
 * @param {Object} [options]
 * @param {string} [options.profile] - CloakBrowser profile name (default `espn`)
 * @returns {{ espn_s2: string, swid: string }}
 * @throws {EspnReauthRequiredError} if the profile has no live session
 */
export const derive_espn_cookies = ({ profile = ESPN_PROFILE } = {}) => {
  log('deriving fresh espn cookies from CloakBrowser profile %s', profile)
  // get-cookies exports the whole jar regardless of the current page; we just
  // need a live daemon. Open the ESPN home (a plain GET, within the profile's
  // allowed_domains) rather than an off-domain page.
  run_cloak_browser(['open', 'https://www.espn.com', '--profile', profile])
  try {
    const stdout = run_cloak_browser(['get-cookies', '--profile', profile])
    let cookies
    try {
      cookies = JSON.parse(stdout)
    } catch (err) {
      throw new Error(
        'could not parse cloak-browser get-cookies output as JSON'
      )
    }
    return extract_espn_cookies(cookies)
  } finally {
    try {
      run_cloak_browser(['close', '--profile', profile])
    } catch (err) {
      log('cloak-browser close warning: %s', err.message)
    }
  }
}

/**
 * Build an HTTP client already authenticated for ESPN private-league access.
 * Preferred interface: the fresh cookie is carried in the client's request
 * headers, so callers make authenticated requests without ever handling the raw
 * s2/swid values.
 * @param {Object} [options]
 * @param {string} [options.base_url] - base URL for the client
 * @param {string} [options.profile] - CloakBrowser profile name
 * @param {{ espn_s2: string, swid: string }} [options.cookies] - pre-derived cookies (skips profile read)
 * @returns {AuthenticatedApiClient}
 */
export const get_espn_authenticated_client = ({
  base_url,
  profile,
  cookies
} = {}) => {
  const resolved = cookies || derive_espn_cookies({ profile })
  return build_espn_client(resolved, { base_url })
}

/**
 * Derive a fresh cookie pair and write the ready-to-use Cookie header to a
 * mode-0600 file for callers that need the raw value out-of-band. The header is
 * written to disk only — never returned in the clear or logged.
 * @param {string} file_path - destination path (created/overwritten with mode 0600)
 * @param {Object} [options]
 * @param {string} [options.profile] - CloakBrowser profile name
 * @param {{ espn_s2: string, swid: string }} [options.cookies] - pre-derived cookies (skips profile read)
 * @returns {{ file_path: string, byte_length: number }} non-sensitive metadata
 */
export const write_espn_cookie_to_file = (
  file_path,
  { profile, cookies } = {}
) => {
  if (!file_path) {
    throw new Error('file_path is required')
  }
  const resolved = cookies || derive_espn_cookies({ profile })
  const cookie_header = build_espn_cookie_header(resolved)
  fs.writeFileSync(file_path, cookie_header, { mode: 0o600 })
  fs.chmodSync(file_path, 0o600)
  log('wrote fresh espn cookie header to %s (mode 0600)', file_path)
  return { file_path, byte_length: Buffer.byteLength(cookie_header) }
}

export default {
  ESPN_PROFILE,
  EspnReauthRequiredError,
  build_espn_cookie_header,
  build_espn_client,
  extract_espn_cookies,
  derive_espn_cookies,
  get_espn_authenticated_client,
  write_espn_cookie_to_file
}

if (is_main(import.meta.url)) {
  const main = () => {
    const out_file_index = process.argv.indexOf('--out-file')
    if (out_file_index === -1 || !process.argv[out_file_index + 1]) {
      // Refuse to emit the cookie to a recorded surface; a 0600 file is required.
      console.error(
        'usage: node libs-server/espn-auth.mjs --out-file <path>\n' +
          'derives a fresh espn cookie from the persisted `espn` CloakBrowser profile\n' +
          'and writes it to <path> (mode 0600); never prints the value.\n' +
          'On REAUTH_REQUIRED, re-establish the session with scripts/espn-signin.mjs.'
      )
      process.exit(2)
    }
    const out_file = process.argv[out_file_index + 1]
    try {
      const { file_path, byte_length } = write_espn_cookie_to_file(out_file)
      console.log(
        `wrote fresh espn cookie header to ${file_path} (${byte_length} bytes, mode 0600)`
      )
      process.exit()
    } catch (error) {
      if (error.reauth_required) {
        console.error(`REAUTH_REQUIRED: ${error.message}`)
        process.exit(75) // EX_TEMPFAIL — awaiting operator re-auth
      }
      console.error(error.message)
      process.exit(1)
    }
  }

  main()
}
