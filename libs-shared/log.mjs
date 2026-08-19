import crypto from 'crypto'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import debug from 'debug'

import config from '#config'

const VALID_SEVERITIES = new Set(['low', 'medium', 'high', 'critical'])
const TITLE_MAX_LENGTH = 200

// Default fetch timeout for the HTTPS transport. uncaughtException handlers
// expect the process to exit; without a timeout a hung connection holds the
// microtask chain open and prevents PM2 from restarting the worker.
const TRANSPORT_TIMEOUT_MS = 5000

const TIMESTAMP_PATTERN = /\d{4}-\d{2}-\d{2}T[\d:.Z+-]+/g
const UUID_PATTERN =
  /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi
const HEX_PATTERN = /\b[a-f0-9]{16,}\b/gi
const PATH_PATTERN = /\/[A-Za-z0-9_./-]+/g
const NUMERIC_PATTERN = /\b\d+\b/g

export const normalize_fingerprint_input = (text) =>
  String(text ?? '')
    .replace(TIMESTAMP_PATTERN, '<ts>')
    .replace(UUID_PATTERN, '<uuid>')
    .replace(HEX_PATTERN, '<hex>')
    .replace(PATH_PATTERN, '<path>')
    .replace(NUMERIC_PATTERN, '<n>')
    .trim()

export const compute_fingerprint = ({ error_class, message }) => {
  const normalized = normalize_fingerprint_input(message)
  return crypto
    .createHash('sha256')
    .update(`${error_class}:${normalized}`)
    .digest('hex')
    .slice(0, 16)
}

const resolve_service = (service) =>
  service || process.env.SERVICE_NAME || 'league-server'

const resolve_suppress_list = (service) => {
  const config_node = config?.log_error?.suppress_fingerprints
  if (!config_node) return []
  if (Array.isArray(config_node)) return config_node
  if (typeof config_node === 'object') {
    const bucket = config_node[service]
    return Array.isArray(bucket) ? bucket : []
  }
  return []
}

const is_suppressed = ({ service, fingerprint }) =>
  resolve_suppress_list(service).includes(fingerprint)

const derive_error_class = (message) => {
  if (message instanceof Error) {
    return message.name || message.constructor?.name || 'Error'
  }
  return 'Error'
}

const derive_message_text = (message) => {
  if (message instanceof Error) return message.message ?? ''
  return String(message ?? '')
}

const first_line = (text) => String(text ?? '').split('\n')[0]

const MACHINE_TOKEN_TTL_MS = 30 * 1000

// Key-file resolution mirrors libs-server/auth/machine-key-loader in the base
// repo (resolve_instance_key_path) rather than requiring BASE_INSTANCE_KEY_FILE
// outright. Being stricter than the loader we sit next to is what made every
// cron-invoked oracle mute on hosts that set only USER_BASE_DIRECTORY: the key
// was on disk at the canonical path the whole time and nothing looked there.
const resolve_key_path = () => {
  const explicit = process.env.BASE_INSTANCE_KEY_FILE
  if (explicit) return explicit
  const user_base_directory = process.env.USER_BASE_DIRECTORY
  if (user_base_directory) {
    return join(user_base_directory, 'config', 'instance-private.key')
  }
  return join(homedir(), '.base-instance-private.key')
}

// The slug is deliberately NOT derived from os.hostname(). Across this fleet
// the short hostname disagrees with the machine_registry slug on three of four
// hosts (macbook2025/macbook, league-production/league, parcels-0/digitalocean-0),
// so a hostname fallback would sign tokens for slugs that do not exist and fail
// one gate later at the API instead of here. Machine identity is genuinely
// per-host configuration; it belongs in the host's cron/service env.
const resolve_machine_slug = () => process.env.BASE_MACHINE_SLUG

// A debug-level line nobody reads is why silent muteness survived: an oracle
// that cannot emit reads as wired in code review. Warn on stderr instead, once
// per distinct reason per process, so cron captures it in the job log on the
// very first run without flooding a hot caller.
const warned_reasons = new Set()

// Exported for tests: the once-per-reason dedup is process-lifetime state, so a
// spec asserting the warning needs to clear it rather than depend on spec order.
export const reset_emission_warnings = () => warned_reasons.clear()

const warn_cannot_emit = (reason) => {
  if (warned_reasons.has(reason)) return
  warned_reasons.add(reason)
  process.stderr.write(`[log_error] signal emission disabled: ${reason}\n`)
}

const sign_machine_token = ({ slug, key_path }) => {
  if (!slug || !key_path || !existsSync(key_path)) return null
  const private_key = crypto.createPrivateKey(readFileSync(key_path, 'utf8'))
  const exp = Date.now() + MACHINE_TOKEN_TTL_MS
  const payload = `${slug}.${exp}`
  const sig = crypto
    .sign(null, Buffer.from(payload), private_key)
    .toString('base64url')
  return `${payload}.${sig}`
}

const post_signal_via_fetch = async ({ signals_api_url, token, body }) => {
  const response = await fetch(`${signals_api_url}/api/signals`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Machine ${token}`
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TRANSPORT_TIMEOUT_MS)
  })
  return response
}

export const create_logger = (namespace, { service } = {}) => {
  const resolved_service = resolve_service(service)
  const debug_log = debug(namespace)

  /**
   * @param {Error | string} message
   * @param {object} [options]
   * @param {Record<string, any>} [options.context] - Forensic payload carried on the signal
   * @param {string} [options.severity]
   * @param {string} [options.fingerprint_override]
   * @param {string} [options.source]
   * @param {string | null} [options.forensic_link]
   */
  const error = (
    message,
    {
      context,
      severity = 'low',
      fingerprint_override,
      source,
      forensic_link = null
    } = {}
  ) => {
    const resolved_severity = VALID_SEVERITIES.has(severity)
      ? severity
      : 'medium'
    if (resolved_severity !== severity) {
      debug_log('invalid severity %s; coerced to medium (caller bug)', severity)
    }

    const error_class = derive_error_class(message)
    const message_text = derive_message_text(message)
    const fingerprint =
      fingerprint_override ||
      compute_fingerprint({ error_class, message: message_text })

    if (is_suppressed({ service: resolved_service, fingerprint })) {
      debug_log('suppressed log_error fingerprint=%s', fingerprint)
      return null
    }

    const signals_api_url = config?.signals_api_url
    const slug = resolve_machine_slug()
    const key_path = resolve_key_path()
    if (!signals_api_url) {
      warn_cannot_emit('signals_api_url not configured')
      debug_log(
        'signals_api_url not configured; log_error not emitted (fingerprint=%s)',
        fingerprint
      )
      return null
    }
    if (!slug) {
      warn_cannot_emit(
        'BASE_MACHINE_SLUG unset (set it in this host cron/service env)'
      )
      debug_log(
        'BASE_MACHINE_SLUG unset; log_error not emitted (fingerprint=%s)',
        fingerprint
      )
      return null
    }
    let token
    try {
      token = sign_machine_token({ slug, key_path })
    } catch (sign_error) {
      debug_log('machine token sign failed: %s', sign_error.message)
      return null
    }
    if (!token) {
      warn_cannot_emit(`instance private key missing at ${key_path}`)
      debug_log(
        'machine token unavailable (missing key file at %s); log_error not emitted (fingerprint=%s)',
        key_path,
        fingerprint
      )
      return null
    }

    const stack_from_error =
      message instanceof Error ? message.stack || null : null
    const merged_context = { ...(context || {}) }
    if (stack_from_error && !merged_context.stack) {
      merged_context.stack = stack_from_error
    }

    const body = {
      source: source || resolved_service,
      kind: 'log_error',
      severity: resolved_severity,
      title: `${error_class}: ${first_line(message_text)}`.slice(
        0,
        TITLE_MAX_LENGTH
      ),
      payload: {
        service: resolved_service,
        namespace,
        error_class,
        error_fingerprint: fingerprint,
        context: merged_context
      },
      // Collapse recurrences of the same (service, fingerprint) into one open
      // signal instead of opening a fresh row per occurrence. The POST ingest
      // route stores dedup_key as-given and does NOT synthesize one, so direct
      // HTTP emitters must supply it. Must stay byte-identical to the canonical
      // `log_error` arm in extension/signals/lib/emit-signal.mjs (default_dedup_key):
      //   `log_error:<service>:<error_fingerprint>`
      dedup_key: `log_error:${resolved_service}:${fingerprint}`,
      forensic_link
    }

    const promise = Promise.resolve()
      .then(() => post_signal_via_fetch({ signals_api_url, token, body }))
      .then((response) => {
        // A rejected POST -- unregistered slug, key not matching the registry
        // pubkey -- is the same silent muteness one gate later, so it warns
        // rather than only reaching debug.
        if (response && !response.ok) {
          warn_cannot_emit(
            `signal POST rejected with ${response.status} (slug=${slug})`
          )
          debug_log('signal POST rejected: %s', response.status)
        }
        return response
      })
      .catch((transport_error) => {
        warn_cannot_emit(`signal POST failed: ${transport_error.message}`)
        debug_log('signal POST failed: %s', transport_error.message)
      })

    return { body, promise }
  }

  const warn = (...args) => debug_log('[warn]', ...args)

  const fn = (...args) => debug_log(...args)
  fn.error = error
  fn.warn = warn
  fn.namespace = namespace
  fn.service = resolved_service
  return fn
}
