// @ts-check
import Knex from 'knex'
import config from '#config'

// The SECOND connection pool, held by league_data_view_reader -- a login role
// that is not a member of pg_read_all_data, holds one explicit GRANT SELECT per
// allowlisted relation, and receives neither arm of the standing ALTER DEFAULT
// PRIVILEGES grants.
//
// WHY A SECOND POOL RATHER THAN `SET ROLE` ON THE MAIN ONE. `RESET ROLE` is
// available from inside any session, so a statement that reaches execution can
// simply drop back to the privileges of the pool's own role. SET ROLE is not a
// sandbox control at all; separate credentials are.
//
// db/index.mjs builds the main pool and is where the pg type parsers are
// registered -- those are process-global, so this pool inherits them by
// importing that module's side effects through the normal server import graph.
//
// Built lazily. An environment with no `postgres_data_view_sandbox` block
// (a developer who has not been given the credential) must fail when a
// sandboxed query is actually run, naming what is missing, rather than at
// server start.
/** @type {import('knex').Knex | null} */
let sandbox_pool = null

export const get_data_view_sandbox_db = () => {
  if (sandbox_pool) return sandbox_pool

  const sandbox_config = config.postgres_data_view_sandbox
  if (!sandbox_config || !sandbox_config.connection) {
    throw new Error(
      'config.postgres_data_view_sandbox is not configured; the sandboxed-SQL ' +
        'data-view tier has no credentials in this environment'
    )
  }

  // The same host/port overrides db/index.mjs applies to the main pool. The
  // suite runs against a throwaway Postgres on :5433 via LEAGUE_DB_PORT, and a
  // sandbox pool that ignored them would quietly point at a developer's local
  // :5432 instead -- connecting successfully, to the wrong database.
  const connection = { ...sandbox_config.connection }
  if (process.env.LEAGUE_DB_HOST) connection.host = process.env.LEAGUE_DB_HOST
  if (process.env.LEAGUE_DB_PORT) connection.port = process.env.LEAGUE_DB_PORT

  sandbox_pool = Knex({
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

  return sandbox_pool
}

// Test seam. The suite builds a pool against the throwaway Postgres and must be
// able to tear it down between files, and a spec that swaps the config needs the
// next call to rebuild rather than to return a pool built from the old one.
export const destroy_data_view_sandbox_db = async () => {
  if (!sandbox_pool) return
  const pool = sandbox_pool
  sandbox_pool = null
  await pool.destroy()
}
