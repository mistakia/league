import crypto from 'crypto'
import { existsSync, readFileSync } from 'fs'
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
    const slug = process.env.BASE_MACHINE_SLUG
    const key_path = process.env.BASE_INSTANCE_KEY_FILE
    if (!signals_api_url) {
      debug_log(
        'signals_api_url not configured; log_error not emitted (fingerprint=%s)',
        fingerprint
      )
      return null
    }
    if (!slug || !key_path) {
      debug_log(
        'BASE_MACHINE_SLUG/BASE_INSTANCE_KEY_FILE unset; log_error not emitted (fingerprint=%s)',
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
      debug_log(
        'machine token unavailable (missing key file); log_error not emitted (fingerprint=%s)',
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
      forensic_link
    }

    const promise = Promise.resolve()
      .then(() => post_signal_via_fetch({ signals_api_url, token, body }))
      .catch((transport_error) => {
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
