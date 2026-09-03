import { redis_cache } from '#libs-server/redis_adapter.mjs'

import { GenerationQueueError } from '#libs-server/data-views/generation/generation-job-queue.mjs'

// What bounds generation, beyond the queue's own depth limit.
//
// THE DEPTH LIMIT AND THESE ARE DIFFERENT CONTROLS. Depth bounds how long a
// caller WAITS; these bound how much a caller may SPEND. A queue of eight is no
// protection at all against one account submitting eight runs an hour for a day.
//
// EVERY LIMIT KEYS ON THE PRINCIPAL KEY, resolved by the one function in
// generation-job-queue.mjs -- `user:<id>` when authenticated and `ip:<addr>`
// otherwise. That is the whole reason the principal key exists as its own
// function with an anonymous branch nothing currently reaches: opening
// generation to anonymous callers must be deleting an admission check, not
// re-keying live limiter state that was stored under a user id.
//
// IN REDIS, so nothing resets on a deploy. An in-process counter would hand
// every caller a fresh budget on each `pm2 reload`, which is the shape of limit
// that reads as enforced and is not.

const KILL_SWITCH_KEY = 'data_view_generation:enabled'
const KILL_SWITCH_ENV = 'LEAGUE_DATA_VIEW_GENERATION_DISABLED'

const RATE_KEY_PREFIX = 'data_view_generation:rate:'
const SPEND_KEY_PREFIX = 'data_view_generation:spend:'

// One hour, and both limits share it so a caller who hits either one is told to
// come back at the same time.
export const LIMIT_WINDOW_SECONDS = 60 * 60

// Runs per principal per window. Sized against the wall clock rather than
// against cost: a run takes minutes and the backend serves one at a time, so
// ten per hour from one caller is already most of the fleet's capacity.
export const MAX_GENERATIONS_PER_WINDOW = 10

// Tokens per principal per window.
export const MAX_TOKENS_PER_WINDOW = 2_000_000

// THE PER-JOB CEILING, and it is deliberately not a fraction of the window
// budget. A single runaway loop must not be able to spend a caller's whole
// allowance and lock them out for an hour on one bad instruction -- so a job
// over this ceiling is recorded against the job and NOT against the window,
// and the caller can try again immediately with a better instruction.
export const MAX_TOKENS_PER_JOB = 500_000

/**
 * Whether generation is switched on.
 *
 * Two controls with opposite failure modes, exactly as
 * data-view-sql-kill-switch.mjs argues for the SQL tier: the Redis key is the
 * operational one and its ABSENCE means enabled (an unreachable Redis reads the
 * same as an unset key, and a Redis blip must not silently disable a feature
 * nobody switched off), while the environment variable is the one that still
 * works when Redis is down, at the cost of a restart.
 *
 * @param {object} [opts]
 * @param {(key: string) => Promise<object|null>} [opts.cache_get]
 * @returns {Promise<boolean>}
 */
export const is_generation_enabled = async ({
  cache_get = (key) => redis_cache.get(key)
} = {}) => {
  if (process.env[KILL_SWITCH_ENV] === '1') return false
  const value = await cache_get(KILL_SWITCH_KEY)
  if (value && value.enabled === false) return false
  return true
}

const window_key = (prefix, principal_key) => `${prefix}${principal_key}`

const read_counter = async (key, cache_get) => {
  const value = await cache_get(key)
  return Number.isFinite(value?.count) ? value.count : 0
}

/**
 * Admit or refuse one generation request, before it reaches the queue.
 *
 * Called at ADMISSION rather than at dispatch, so a caller over their limit
 * learns immediately instead of watching a queued job they will never get.
 *
 * @param {object} params
 * @param {string} params.principal_key
 * @param {(key: string) => Promise<object|null>} [params.cache_get]
 * @param {(key: string, value: object, ttl: number) => Promise<void>} [params.cache_set]
 * @returns {Promise<void>} resolves when admitted; throws GenerationQueueError otherwise
 */
export const assert_generation_admissible = async ({
  principal_key,
  cache_get = (key) => redis_cache.get(key),
  cache_set = (key, value, ttl) => redis_cache.set(key, value, ttl)
}) => {
  if (!(await is_generation_enabled({ cache_get }))) {
    throw new GenerationQueueError(
      'generation_disabled',
      'view generation is switched off'
    )
  }

  const rate_key = window_key(RATE_KEY_PREFIX, principal_key)
  const spend_key = window_key(SPEND_KEY_PREFIX, principal_key)

  const [runs, tokens] = await Promise.all([
    read_counter(rate_key, cache_get),
    read_counter(spend_key, cache_get)
  ])

  if (runs >= MAX_GENERATIONS_PER_WINDOW) {
    throw new GenerationQueueError(
      'generation_rate_limited',
      `this account has run ${runs} generations in the last hour, at a limit of ${MAX_GENERATIONS_PER_WINDOW}`,
      { runs, max_runs: MAX_GENERATIONS_PER_WINDOW }
    )
  }

  if (tokens >= MAX_TOKENS_PER_WINDOW) {
    throw new GenerationQueueError(
      'generation_budget_exhausted',
      'this account has spent its hourly generation token budget',
      { total_tokens: tokens, max_tokens: MAX_TOKENS_PER_WINDOW }
    )
  }

  // Counted on ADMISSION, not on completion, so a caller cannot open ten runs
  // at once between two completions. Read-modify-write rather than INCR because
  // the cache adapter stores JSON values and exposes no atomic counter; the
  // overshoot is bounded by concurrent admissions, which the queue's own depth
  // limit already caps at eight.
  await cache_set(rate_key, { count: runs + 1 }, LIMIT_WINDOW_SECONDS)
}

/**
 * Record what a finished run spent against its principal's window budget.
 *
 * @param {object} params
 * @param {string} params.principal_key
 * @param {number|null} params.total_tokens
 * @param {(key: string) => Promise<object|null>} [params.cache_get]
 * @param {(key: string, value: object, ttl: number) => Promise<void>} [params.cache_set]
 * @returns {Promise<{charged: number, over_job_ceiling: boolean}>}
 */
export const record_generation_spend = async ({
  principal_key,
  total_tokens,
  cache_get = (key) => redis_cache.get(key),
  cache_set = (key, value, ttl) => redis_cache.set(key, value, ttl)
}) => {
  if (!Number.isFinite(total_tokens) || total_tokens <= 0) {
    return { charged: 0, over_job_ceiling: false }
  }

  // See MAX_TOKENS_PER_JOB: an oversized job is refused WITHOUT touching the
  // window budget, so one runaway cannot lock its caller out for an hour.
  if (total_tokens > MAX_TOKENS_PER_JOB) {
    return { charged: 0, over_job_ceiling: true }
  }

  const spend_key = window_key(SPEND_KEY_PREFIX, principal_key)
  const spent = await read_counter(spend_key, cache_get)
  await cache_set(
    spend_key,
    { count: spent + total_tokens },
    LIMIT_WINDOW_SECONDS
  )
  return { charged: total_tokens, over_job_ceiling: false }
}

export const GENERATION_KILL_SWITCH_REDIS_KEY = KILL_SWITCH_KEY
export const GENERATION_KILL_SWITCH_ENV_VAR = KILL_SWITCH_ENV

export default {
  assert_generation_admissible,
  is_generation_enabled,
  record_generation_spend,
  LIMIT_WINDOW_SECONDS,
  MAX_GENERATIONS_PER_WINDOW,
  MAX_TOKENS_PER_JOB,
  MAX_TOKENS_PER_WINDOW
}
