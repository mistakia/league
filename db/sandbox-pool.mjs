// @ts-check
import Knex from 'knex'
import config from '#config'

// The sandbox connection pools -- one per scoped read role, each held by a
// login role that is not a member of pg_read_all_data, holds one explicit
// GRANT SELECT per allowlisted relation, and receives neither arm of the
// standing ALTER DEFAULT PRIVILEGES grants.
//
// WHY A SEPARATE POOL RATHER THAN `SET ROLE` ON THE MAIN ONE. `RESET ROLE` is
// available from inside any session, so a statement that reaches execution can
// simply drop back to the privileges of the pool's own role. SET ROLE is not a
// sandbox control at all; separate credentials are.
//
// WHY ONE POOL PER ROLE RATHER THAN ONE SHARED SANDBOX ROLE. The two consumers
// read overlapping but genuinely different relation sets, and a single role
// would have to be the union. Widening the data-view tier's allowlist to serve
// reproduction would weaken a user-facing control for an unrelated reason,
// which is the coupling this split exists to prevent. See
// db/tools/generate-reader-role-grants.mjs for each role's reviewed list.
//
// db/index.mjs builds the main pool and is where the pg type parsers are
// registered -- those are process-global, so these pools inherit them by
// importing that module's side effects through the normal server import graph.
//
// Built lazily. An environment with no config block for a role (a developer who
// has not been given the credential) must fail when a sandboxed query is
// actually run, naming what is missing, rather than at server start.

/**
 * Config key per sandbox role. The key is the identity of the pool -- callers
 * name a role, never a connection.
 *
 * @type {Record<string, string>}
 */
export const SANDBOX_POOLS = {
  data_view: 'postgres_data_view_sandbox',
  contribution: 'postgres_contribution_sandbox'
}

/** @type {Map<string, import('knex').Knex>} */
const pools = new Map()

/**
 * @param {string} pool_name - a key of SANDBOX_POOLS
 * @returns {import('knex').Knex}
 */
export const get_sandbox_db = (pool_name) => {
  const existing = pools.get(pool_name)
  if (existing) return existing

  const config_key = SANDBOX_POOLS[pool_name]
  if (!config_key) {
    throw new Error(
      `unknown sandbox pool ${pool_name}; expected one of ${Object.keys(SANDBOX_POOLS).join(', ')}`
    )
  }

  const sandbox_config = config[config_key]
  if (!sandbox_config || !sandbox_config.connection) {
    throw new Error(
      `config.${config_key} is not configured; the ${pool_name} sandbox has no ` +
        'credentials in this environment'
    )
  }

  // The same host/port/database overrides db/index.mjs applies to the main
  // pool. The suite runs against a throwaway Postgres on :5433 via
  // LEAGUE_DB_PORT, and a sandbox pool that ignored them would quietly point at
  // a developer's local :5432 instead -- connecting successfully, to the wrong
  // database.
  //
  // LEAGUE_DB_DATABASE is here for the same reason and was MISSING until
  // 2026-09-02, which made the warning above true of this pool itself. Under
  // `yarn test:isolated` that variable names a per-run database while the main
  // pool follows it and this one did not, so every sandboxed query in an
  // isolated run reached the SHARED league_test -- reading rows the run had not
  // written, and writing its audit rows where a concurrent run would see them.
  // The one sandbox spec that exists never caught it because it passes its own
  // pool explicitly.
  const connection = { ...sandbox_config.connection }
  if (process.env.LEAGUE_DB_HOST) connection.host = process.env.LEAGUE_DB_HOST
  if (process.env.LEAGUE_DB_PORT) connection.port = process.env.LEAGUE_DB_PORT
  if (process.env.LEAGUE_DB_DATABASE) {
    connection.database = process.env.LEAGUE_DB_DATABASE
  }

  const pool = Knex({
    ...sandbox_config,
    connection,
    pool: {
      ...(sandbox_config.pool || {}),
      /**
       * @param {import('pg').Client} connection
       * @param {(err: Error | null, connection: import('pg').Client) => void} done
       */
      afterCreate: (connection, done) => {
        connection.query('SELECT 1', (/** @type {Error | null} */ err) =>
          done(err, connection)
        )
      }
    }
  })

  pools.set(pool_name, pool)
  return pool
}

// Test seam. The suite builds a pool against the throwaway Postgres and must be
// able to tear it down between files, and a spec that swaps the config needs the
// next call to rebuild rather than to return a pool built from the old one.
/**
 * @param {string} [pool_name] - omit to destroy every built pool
 */
export const destroy_sandbox_db = async (pool_name) => {
  const names = pool_name ? [pool_name] : [...pools.keys()]
  for (const name of names) {
    const pool = pools.get(name)
    if (!pool) continue
    pools.delete(name)
    await pool.destroy()
  }
}
