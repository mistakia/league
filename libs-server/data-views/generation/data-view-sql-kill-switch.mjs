import { redis_cache } from '#libs-server/redis_adapter.mjs'

// The kill switch for the sandboxed-SQL data-view tier.
//
// It lives here rather than on the generation task because a SAVED view of this
// tier reaches execution without passing through generation at all: someone
// opens a share link, the executor runs a persisted statement, and no
// generation code is on that path. A switch owned by generation would not be
// read on the path that most needs it.
//
// TWO CONTROLS, deliberately, because they fail in opposite directions.
//
// The Redis key is the operational one: an operator sets it and every server
// picks it up without a deploy. Its absence means ENABLED, because
// redis_cache.get returns null both when a key is unset and when Redis is
// unreachable, and treating those alike would mean a Redis blip silently
// disabled a feature nobody had switched off.
//
// The environment variable is the one that cannot be defeated by an unreachable
// Redis. If Redis is down and the tier must be stopped NOW, this is the control
// that works; it costs a restart, which is the trade being made.
const KILL_SWITCH_KEY = 'data_view_sql:enabled'
const KILL_SWITCH_ENV = 'LEAGUE_DATA_VIEW_SQL_DISABLED'

export class DataViewSqlDisabledError extends Error {
  constructor(message) {
    super(message)
    this.name = 'DataViewSqlDisabledError'
    this.code = 'data_view_sql_disabled'
  }
}

/**
 * @param {object} [opts]
 * @param {(key: string) => Promise<object|null>} [opts.cache_get] - test seam
 * @returns {Promise<boolean>}
 */
export const is_data_view_sql_enabled = async ({
  cache_get = (key) => redis_cache.get(key)
} = {}) => {
  if (process.env[KILL_SWITCH_ENV] === '1') return false

  const value = await cache_get(KILL_SWITCH_KEY)
  if (value && value.enabled === false) return false

  return true
}

/**
 * Throws unless the tier is enabled. Called at execution, so a saved view
 * refuses to run rather than executing arbitrary generated SQL.
 *
 * @param {object} [opts]
 * @param {(key: string) => Promise<object|null>} [opts.cache_get] - test seam
 */
export const assert_data_view_sql_enabled = async (opts = {}) => {
  if (!(await is_data_view_sql_enabled(opts))) {
    throw new DataViewSqlDisabledError(
      'the sandboxed-SQL data-view tier is disabled; saved SQL views will not execute'
    )
  }
}

// Bulk remediation for views already saved when the switch is thrown. The
// provenance columns on data_view_queries -- which the query-backed task owns --
// identify them: every saved view whose statement came from this tier carries a
// query_id, so disabling the tier is sufficient to stop all of them at once and
// the remediation is a SELECT over that table, not a migration. Stated here so
// the switch's blast radius is documented where the switch is.
export const KILL_SWITCH_REDIS_KEY = KILL_SWITCH_KEY
export const KILL_SWITCH_ENV_VAR = KILL_SWITCH_ENV
