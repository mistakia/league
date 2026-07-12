import pg from 'pg'
import Knex from 'knex'
import config from '#config'

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
    afterCreate: (connection, done) => {
      connection.query('SELECT 1', (err) => done(err, connection))
    }
  }
}

const postgres = Knex(postgres_config)
export default postgres
