import { redis_cache } from '#libs-server/redis_adapter.mjs'

// What the user sees while a run is still running.
//
// THE GAP THIS CLOSES. The job row moves through three live states -- queued,
// dispatched, running -- and then says nothing for the rest of the run. The
// socket watcher only frames on a status CHANGE, so a client that reached
// `running` in the first four seconds sat on one unchanging word for up to
// fifteen minutes. Measured 2026-09-04: a run spent six minutes retrying a
// broken tool behind a static "Building the view", and nothing on the wire
// distinguished it from a run that was making progress.
//
// IN REDIS, NOT ON THE JOB ROW, and that is the whole design decision. Progress
// is worth exactly as much as the run is long: once the job reaches a terminal
// state the row's own result, error and trajectory say everything a later
// reader wants, and a step counter frozen at the moment of death answers no
// question anyone asks. Persisting it would buy three schema columns, a
// dev-fixture disposition, a vocabulary entry and a permanent read tax, in
// exchange for a value whose useful life is fifteen minutes. It expires on its
// own instead.
//
// ABSENCE IS NOT AN ERROR. An unreachable Redis, a run that has not called a
// tool yet, and a run predating this module all read as null, and every caller
// treats that as "no progress to show" rather than as a fault. The status word
// is still there underneath, which is exactly the behaviour the client had
// before this existed.

const PROGRESS_KEY_PREFIX = 'data_view_generation:progress:'

// Longer than the 15-minute job deadline, so a run that goes the distance keeps
// its last step visible through the expiry sweep and the frame that reports it.
export const PROGRESS_TTL_SECONDS = 20 * 60

/**
 * @param {string} generation_id
 * @returns {string}
 */
export const progress_key = (generation_id) =>
  `${PROGRESS_KEY_PREFIX}${generation_id}`

/**
 * Record one tool call against a run.
 *
 * THE COUNT IS THE SERVER'S, NOT THE AGENT'S. Each tool is a separate
 * short-lived CLI process with no memory of the last one, so the container
 * cannot number its own calls without inventing a counter file to lose. Reading
 * the previous value and adding one keeps the container stateless, and the race
 * a read-modify-write invites cannot occur here: the profile permits one
 * concurrent session and an agent's tool calls are sequential within it.
 *
 * @param {object} params
 * @param {string} params.generation_id
 * @param {string} params.tool - the tool being invoked, e.g. preview_view
 * @param {(key: string) => Promise<object|null>} [params.cache_get]
 * @param {(key: string, value: object, ttl: number) => Promise<void>} [params.cache_set]
 * @returns {Promise<{step_count: number, tool: string}>}
 */
export const record_generation_progress = async ({
  generation_id,
  tool,
  cache_get = (key) => redis_cache.get(key),
  cache_set = (key, value, ttl) => redis_cache.set(key, value, ttl)
}) => {
  const key = progress_key(generation_id)
  const previous = await cache_get(key)
  const step_count = Number.isFinite(previous?.step_count)
    ? previous.step_count + 1
    : 1

  const progress = { step_count, tool, updated_at: Date.now() }
  await cache_set(key, progress, PROGRESS_TTL_SECONDS)
  return progress
}

/**
 * Read a run's progress, or null when there is none.
 *
 * @param {object} params
 * @param {string} params.generation_id
 * @param {(key: string) => Promise<object|null>} [params.cache_get]
 * @returns {Promise<{step_count: number, tool: string, updated_at: number}|null>}
 */
export const read_generation_progress = async ({
  generation_id,
  cache_get = (key) => redis_cache.get(key)
}) => {
  const progress = await cache_get(progress_key(generation_id))
  if (!progress || !Number.isFinite(progress.step_count)) return null
  return progress
}

export default {
  PROGRESS_TTL_SECONDS,
  progress_key,
  read_generation_progress,
  record_generation_progress
}
