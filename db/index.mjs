// @ts-check
import pg from 'pg'
import Knex from 'knex'
import config, { assert_sandbox_credentials } from '#config'

pg.types.setTypeParser(pg.types.builtins.NUMERIC, Number)
pg.types.setTypeParser(pg.types.builtins.INT8, Number)

if (process.env.LEAGUE_DB_HOST) {
  config.postgres.connection.host = process.env.LEAGUE_DB_HOST
}
if (process.env.LEAGUE_DB_PORT) {
  config.postgres.connection.port = process.env.LEAGUE_DB_PORT
}
if (process.env.LEAGUE_DB_USER) {
  config.postgres.connection.user = process.env.LEAGUE_DB_USER
}
if (process.env.LEAGUE_DB_PASSWORD) {
  config.postgres.connection.password = process.env.LEAGUE_DB_PASSWORD
}
if (process.env.LEAGUE_DB_DATABASE) {
  config.postgres.connection.database = process.env.LEAGUE_DB_DATABASE
}

// Validate every newly-created pooled connection with a cheap round-trip before
// it is handed out. A connection built against a half-open socket (server idle
// timeout, network blip) is discarded when the afterCreate callback errors,
// rather than being the connection a caller's next query fails on. This hardens
// the create path; the terminal-write retry in libs-server/report-job.mjs covers
// the complementary case of a connection that goes stale while idle in the pool.
// Config JSON cannot carry a function, so the hook is injected here.
const postgres_config = {
  ...config.postgres,
  pool: {
    ...(config.postgres.pool || {}),
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
}

// ANCHOR THE SANDBOX CREDENTIAL REQUIREMENT AT THE POOL, NOT AT ITS CALLERS.
//
// The named refusal is asserted in the two agent tools that open a connection
// and in db/sandbox-pool.mjs. That is three hand-placed call sites and nothing
// enforcing a fourth: any NEW sandbox entry point importing this module -- the
// generation drainer, a debug CLI, a REPL -- would connect with the committed
// blank host and password and get a raw pg error naming neither the config nor
// the variable. Knex calls a function-valued `connection` per connection, so
// putting the assert here makes the guarantee structural.
//
// Scoped to NODE_ENV=sandbox deliberately: every other environment keeps the
// plain object it has always had, so this cannot change how development, test
// or production connect.
const connection_config =
  process.env.NODE_ENV === 'sandbox'
    ? () => {
        assert_sandbox_credentials()
        return postgres_config.connection
      }
    : postgres_config.connection

const postgres = Knex({ ...postgres_config, connection: connection_config })
export default postgres
