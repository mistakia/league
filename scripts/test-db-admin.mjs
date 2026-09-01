// Run one admin statement against the shared :5433 test Postgres and print the
// result the way `psql -tAc` does: one row per line, columns tab-separated, no
// header and no padding. scripts/test-isolated.sh parses it that way.
//
// WHY THIS EXISTS
//
// The CREATE DATABASE / DROP DATABASE that bracket an isolated run used to shell
// out to `docker exec -u postgres league-test-pg psql`, which needs a docker
// socket purely to borrow a psql client. Inside base-container there is no
// docker and no socket, so the whole isolated runner was unusable there even
// though the suite's own connection to :5433 is plain TCP and works fine. Going
// through `pg` -- already a direct dependency, already how mocha connects --
// drops the docker requirement and the psql binary requirement together, and
// behaves identically on a host that does have both.
//
// Connects as the DB_USER superuser-equivalent role that compose.test.yaml
// creates (POSTGRES_USER), not as `postgres`, because that is the role the
// container hands the password to.

import pg from 'pg'

const sql = process.argv[2]

if (!sql) {
  console.error('usage: node scripts/test-db-admin.mjs "<sql>"')
  process.exit(2)
}

const client = new pg.Client({
  host: process.env.LEAGUE_TEST_DB_HOST || '127.0.0.1',
  port: Number(process.env.LEAGUE_TEST_DB_PORT || 5433),
  user: process.env.LEAGUE_TEST_DB_USER || 'league_test',
  password: process.env.LEAGUE_TEST_DB_PASSWORD || 'league_test',
  // The maintenance database, never the per-run one -- CREATE/DROP DATABASE
  // cannot run from inside the database being created or dropped.
  database: process.env.LEAGUE_TEST_DB_ADMIN_DATABASE || 'league_test',
  connectionTimeoutMillis: 10000
})

try {
  await client.connect()
  const result = await client.query(sql)
  for (const row of result.rows) {
    console.log(Object.values(row).join('\t'))
  }
} catch (error) {
  console.error(`test-db-admin: ${error.message}`)
  process.exitCode = 1
} finally {
  await client.end().catch(() => {})
}
