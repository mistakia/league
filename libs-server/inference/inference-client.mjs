// The one outbound inference path for this repo: an openai-chat client
// speaking the fleet inference gateway's wire contract.
//
// NOT A PORT of base's libs-server/llm/inference-client.mjs. League and base
// are separate projects with independent deploys and no shared code, and that
// client carries fleet semantics this path does not need -- role dispatch,
// queue admission, warm-set arbitration. What is shared is a BOUNDARY, not an
// implementation: the gateway itself is the source of truth for the contract
// below (base server/services/inference-gateway/ABOUT.md and
// text/base/model-dispatch-architecture.md), and this module cites it rather
// than restating it.
//
// The load-bearing surface, all of it observable at the gateway:
//
//   PATH ROUTING     <base_url>/<inference_provider>/v1/chat/completions. The
//                    FIRST path segment selects the provider; everything after
//                    it is forwarded verbatim. So the provider id is a routing
//                    key, which is why it is copied from the fleet registry
//                    rather than coined here -- a divergent spelling is a
//                    runtime 404, not a config warning.
//
//   AUTH             `Authorization: Machine <slug.exp.aud.sig>`, Ed25519, 30s
//                    TTL, audience `inference-gateway`. Minted per request:
//                    caching a 30-second credential is how you get an
//                    intermittent 401 with no local cause.
//
//   CONTENTION       503, or 429 carrying `x-inference-refusal`, means the
//                    model pool is busy and the request may be retried after
//                    `retry-after`. A 429 WITHOUT that header is a real rate
//                    limit and is not retried here. Keeping the two apart is
//                    what stops model-pool contention from polluting the
//                    fall-through audit with fake "the registry fell short"
//                    rows.
//
//   STRUCTURED OUT   Declared per provider (`structured_output_mode`), never
//                    inferred. base's client branches on whether an api_key is
//                    present, which conflates a CREDENTIAL with a SERVER
//                    CAPABILITY -- they are independent, and the day a
//                    key-authenticated vLLM wants guided_json that branch
//                    silently sends the wrong body.
//
// TWO AUTH LAYERS, AND THEY FAIL FOR UNRELATED REASONS. A 403 with an HTML
// body is Cloudflare Access rejecting the service token at the edge -- the
// request never reached the fleet. A 401 with a JSON body is the gateway
// rejecting the machine token: clock skew, wrong audience, or a token older
// than its TTL. They are separate error classes here because collapsing them
// sends a debugger to the wrong host entirely.

import Ajv from 'ajv'
import debug from 'debug'

import config from '#config'
import { mint_machine_token } from '#libs-server/machine-token.mjs'

const log = debug('inference-client')

const GATEWAY_AUDIENCE = 'inference-gateway'
const INFERENCE_REFUSAL_HEADER = 'x-inference-refusal'
const DEFAULT_TIMEOUT_MS = 120 * 1000
const DEFAULT_MAX_ATTEMPTS = 3

// qwen3.8 accepts exactly these three and 400s on anything else, including the
// OpenAI-familiar 'high'.
const REASONING_EFFORTS = ['xhigh', 'medium', 'low']

const STRUCTURED_OUTPUT_MODES = ['json_schema', 'guided_json']
const AUTH_MODES = ['machine_token', 'api_key']

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/**
 * Every failure of this path carries a `code`, because the route above maps
 * code to HTTP status and to a user-visible notice, and a bare Error there
 * becomes a 400 that blames the caller for an outage.
 */
export class InferenceError extends Error {
  constructor({ message, code, status = null, retry_after_ms = null }) {
    super(message)
    this.name = 'InferenceError'
    this.code = code
    this.status = status
    this.retry_after_ms = retry_after_ms
  }
}

export const INFERENCE_ERROR_CODES = {
  // The edge refused us. Nothing on the fleet saw this request.
  edge_rejected: 'inference_edge_rejected',
  // The gateway refused our machine token.
  gateway_auth_rejected: 'inference_gateway_auth_rejected',
  // The model pool is busy. Retryable, and NOT an outage.
  contended: 'inference_contended',
  // A real rate limit, ours or a vendor's.
  rate_limited: 'inference_rate_limited',
  unreachable: 'inference_unreachable',
  timed_out: 'inference_timed_out',
  // The provider answered, and the answer was not the shape we asked for.
  malformed_output: 'inference_malformed_output',
  // Anything else the provider said, verbatim status preserved.
  provider_error: 'inference_provider_error',
  // Ours, not theirs: the config or the call is wrong.
  misconfigured: 'inference_misconfigured'
}

// ---------------------------------------------------------------------------
// Provider resolution
// ---------------------------------------------------------------------------

/**
 * The resolved provider object for a registry id.
 *
 * @param {object} [params]
 * @param {string} [params.inference_provider]
 * @param {object} [params.inference_providers]
 * @returns {object}
 */
export const resolve_inference_provider = ({
  inference_provider,
  inference_providers = config.inference_providers
} = {}) => {
  if (!inference_providers) {
    throw new InferenceError({
      message:
        'config carries no inference_providers block -- this environment cannot reach the gateway',
      code: INFERENCE_ERROR_CODES.misconfigured
    })
  }

  const id = inference_provider || inference_providers.default
  if (!id) {
    throw new InferenceError({
      message:
        'no inference_provider given and inference_providers.default is unset',
      code: INFERENCE_ERROR_CODES.misconfigured
    })
  }

  const provider = inference_providers[id]
  if (!provider) {
    throw new InferenceError({
      message: `unknown inference_provider '${id}'`,
      code: INFERENCE_ERROR_CODES.misconfigured
    })
  }

  for (const [field, permitted] of [
    ['auth_mode', AUTH_MODES],
    ['structured_output_mode', STRUCTURED_OUTPUT_MODES]
  ]) {
    if (!permitted.includes(provider[field])) {
      throw new InferenceError({
        message: `inference_provider '${id}' declares ${field}='${provider[field]}' -- must be one of ${permitted.join(', ')}`,
        code: INFERENCE_ERROR_CODES.misconfigured
      })
    }
  }

  // Dev and test ship a blank base_url on purpose. This repository is PUBLIC
  // and every file in it is published, so the LAN address of the fleet gateway
  // does not go in config-development.json any more than a credential does --
  // the same reason signals_api_url is blank in both files. The env var is how
  // a developer and the evaluation harness point at base-storage without
  // editing a published file.
  const base_url = process.env.LEAGUE_INFERENCE_BASE_URL || provider.base_url

  if (!base_url || !provider.model) {
    throw new InferenceError({
      message: `inference_provider '${id}' is missing base_url or model. Under a non-production NODE_ENV the base_url is deliberately blank -- set LEAGUE_INFERENCE_BASE_URL to the gateway you are developing against`,
      code: INFERENCE_ERROR_CODES.misconfigured
    })
  }

  return { ...provider, base_url, inference_provider: id }
}

// ---------------------------------------------------------------------------
// Request
// ---------------------------------------------------------------------------

const build_headers = ({ provider }) => {
  const headers = { 'content-type': 'application/json' }

  if (provider.auth_mode === 'machine_token') {
    const token = mint_machine_token({ audience: GATEWAY_AUDIENCE })
    if (!token) {
      // A hard failure rather than the emitter's mute no-op: a generation
      // request that proceeds unauthenticated just fails at the edge, one hop
      // further from the cause.
      throw new InferenceError({
        message:
          'cannot mint a machine token (BASE_MACHINE_SLUG unset or the instance key is unreadable)',
        code: INFERENCE_ERROR_CODES.misconfigured
      })
    }
    headers.authorization = `Machine ${token}`
  } else {
    if (!provider.api_key) {
      throw new InferenceError({
        message: `inference_provider '${provider.inference_provider}' declares auth_mode=api_key and carries no api_key`,
        code: INFERENCE_ERROR_CODES.misconfigured
      })
    }
    headers.authorization = `Bearer ${provider.api_key}`
  }

  // Cloudflare Access service-token headers on the production tunnel. They do
  // not collide with `Authorization: Machine`: Access reads its own pair and
  // passes the Authorization header through untouched.
  for (const [name, value] of Object.entries(provider.headers || {})) {
    headers[name] = value
  }

  return headers
}

const build_body = ({ provider, system, prompt, schema, max_tokens }) => {
  const messages = []
  if (system) messages.push({ role: 'system', content: system })
  messages.push({ role: 'user', content: prompt })

  const body = { model: provider.model, messages }

  if (max_tokens !== undefined) body.max_tokens = max_tokens
  if (provider.temperature !== undefined)
    body.temperature = provider.temperature

  if (provider.reasoning_effort !== undefined) {
    if (!REASONING_EFFORTS.includes(provider.reasoning_effort)) {
      throw new InferenceError({
        message: `reasoning_effort='${provider.reasoning_effort}' is rejected with a 400 by the provider -- must be one of ${REASONING_EFFORTS.join(', ')}`,
        code: INFERENCE_ERROR_CODES.misconfigured
      })
    }
    body.reasoning_effort = provider.reasoning_effort
  }

  if (schema) {
    if (provider.structured_output_mode === 'json_schema') {
      body.response_format = {
        type: 'json_schema',
        json_schema: { name: 'result', strict: true, schema }
      }
    } else {
      body.response_format = { type: 'json_object' }
      body.guided_json = schema
    }
  }

  return body
}

const parse_retry_after = (header) => {
  if (!header) return null
  const seconds = Number(header)
  return Number.isFinite(seconds) ? Math.max(0, seconds * 1000) : null
}

/**
 * Which failure this is. Ordered so the two auth layers are separated before
 * anything generic can swallow them.
 */
const classify_response = async ({ response }) => {
  const body = await response.text().catch(() => '')
  const content_type = response.headers.get('content-type') || ''

  if (response.status === 403) {
    return new InferenceError({
      message:
        'Cloudflare Access refused the request at the edge (403) -- the service token is missing, wrong, or expired, and the request never reached the gateway. ' +
        `content-type=${content_type || 'none'}`,
      code: INFERENCE_ERROR_CODES.edge_rejected,
      status: 403
    })
  }

  if (response.status === 401) {
    return new InferenceError({
      message: `the inference gateway rejected the machine token (401) -- clock skew, wrong audience, or a token older than its 30s TTL: ${body.slice(0, 400)}`,
      code: INFERENCE_ERROR_CODES.gateway_auth_rejected,
      status: 401
    })
  }

  const retry_after_ms = parse_retry_after(response.headers.get('retry-after'))

  if (
    response.status === 503 ||
    (response.status === 429 && response.headers.get(INFERENCE_REFUSAL_HEADER))
  ) {
    return new InferenceError({
      message: `the model pool is contended (${response.status}) -- this is a busy fleet, not an outage: ${body.slice(0, 400)}`,
      code: INFERENCE_ERROR_CODES.contended,
      status: response.status,
      retry_after_ms: retry_after_ms ?? 5000
    })
  }

  if (response.status === 429) {
    return new InferenceError({
      message: `rate limited (429), with no ${INFERENCE_REFUSAL_HEADER} header -- a real limit rather than fleet contention: ${body.slice(0, 400)}`,
      code: INFERENCE_ERROR_CODES.rate_limited,
      status: 429,
      retry_after_ms
    })
  }

  return new InferenceError({
    message: `inference provider error ${response.status}: ${body.slice(0, 400)}`,
    code: INFERENCE_ERROR_CODES.provider_error,
    status: response.status
  })
}

const ajv = new Ajv({ allErrors: true, strict: false })
const validator_cache = new WeakMap()

const validate_against_schema = ({ schema, value }) => {
  let validate = validator_cache.get(schema)
  if (!validate) {
    validate = ajv.compile(schema)
    validator_cache.set(schema, validate)
  }
  if (validate(value)) return

  throw new InferenceError({
    message: `the provider's output does not satisfy the requested schema: ${ajv.errorsText(validate.errors)}`,
    code: INFERENCE_ERROR_CODES.malformed_output
  })
}

/**
 * The provider's message content, parsed and checked.
 *
 * Structured-output modes are a REQUEST, not a guarantee -- guided decoding can
 * be truncated by max_tokens mid-object, and a provider that ignores the field
 * answers prose. So the schema is enforced here as well as asked for there;
 * passing an unvalidated object on is how a fabricated table_state reaches the
 * resolver looking well-formed.
 */
export const extract_output = ({ data, schema }) => {
  const content = data?.choices?.[0]?.message?.content

  if (typeof content !== 'string' || !content.length) {
    throw new InferenceError({
      message:
        'the provider returned no message content (choices[0].message.content was empty or absent)',
      code: INFERENCE_ERROR_CODES.malformed_output
    })
  }

  let parsed
  try {
    parsed = JSON.parse(content)
  } catch (error) {
    throw new InferenceError({
      message: `the provider's output is not JSON: ${error.message}`,
      code: INFERENCE_ERROR_CODES.malformed_output
    })
  }

  if (schema) validate_against_schema({ schema, value: parsed })

  return parsed
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * One structured-output completion.
 *
 * @param {object} params
 * @param {string} params.prompt
 * @param {string} [params.system]
 * @param {object} [params.schema] - JSON schema; enforced on the way back
 * @param {string} [params.inference_provider]
 * @param {object} [params.provider] - a resolved provider, for tests
 * @param {number} [params.max_tokens]
 * @param {number} [params.timeout_ms]
 * @param {number} [params.max_attempts] - contention retries, not error retries
 * @param {(url: string, init: object) => Promise<Response>} [params.fetch_impl]
 * @returns {Promise<{ output: object, duration_ms: number, model: string, inference_provider: string, attempts: number }>}
 */
export const call_inference = async ({
  prompt,
  system,
  schema,
  inference_provider,
  provider: given_provider,
  max_tokens,
  timeout_ms = DEFAULT_TIMEOUT_MS,
  max_attempts = DEFAULT_MAX_ATTEMPTS,
  fetch_impl = fetch
}) => {
  const provider =
    given_provider || resolve_inference_provider({ inference_provider })

  const url = `${provider.base_url.replace(/\/$/, '')}/${provider.inference_provider}/v1/chat/completions`
  const body = build_body({ provider, system, prompt, schema, max_tokens })

  const started_at = Date.now()
  let attempt = 0

  for (;;) {
    attempt += 1

    // Re-minted per attempt rather than per call. A 30-second TTL against a
    // retry that waited on `retry-after` is otherwise an expired token on the
    // second try, which arrives as a 401 and reads as a credential fault.
    const headers = build_headers({ provider })

    let response
    try {
      response = await fetch_impl(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeout_ms)
      })
    } catch (error) {
      if (error.name === 'TimeoutError' || error.name === 'AbortError') {
        throw new InferenceError({
          message: `inference timed out after ${timeout_ms}ms`,
          code: INFERENCE_ERROR_CODES.timed_out
        })
      }
      throw new InferenceError({
        message: `cannot reach the inference gateway at ${provider.base_url}: ${error.message}`,
        code: INFERENCE_ERROR_CODES.unreachable
      })
    }

    if (!response.ok) {
      const error = await classify_response({ response })

      const retryable = error.code === INFERENCE_ERROR_CODES.contended
      if (retryable && attempt < max_attempts) {
        log(
          'contended (%s), attempt %d of %d, waiting %dms',
          error.status,
          attempt,
          max_attempts,
          error.retry_after_ms
        )
        await sleep(error.retry_after_ms)
        continue
      }

      throw error
    }

    let data
    try {
      data = await response.json()
    } catch (error) {
      throw new InferenceError({
        message: `the provider answered 200 with a body that is not JSON: ${error.message}`,
        code: INFERENCE_ERROR_CODES.malformed_output
      })
    }

    return {
      output: extract_output({ data, schema }),
      duration_ms: Date.now() - started_at,
      model: provider.model,
      inference_provider: provider.inference_provider,
      attempts: attempt
    }
  }
}

export default call_inference
