// Registers the test-only webpack resolution hook before any spec file loads,
// so a spec can `import` from `@core/...` the way the SPA does. Mocha loads
// `--require` modules ahead of the spec files, which is what makes this the
// right place for it. Strictly additive -- see the module's own header.
import './webpack-resolve/register.mjs'

import knex from '#db'
import { assert_destructive_target_allowed } from '#db/guard-destructive-target.mjs'
import path, { dirname } from 'path'
import fs from 'fs/promises'
import { fileURLToPath } from 'url'
import MockDate from 'mockdate'
import scoring_formats_seed from '#db/fixtures/scoring-formats.mjs'
import server from '#api'

// Pin the suite's clock. Anything clock-derived (data view "next week"
// matchups, current_season week/seas_type) otherwise varies with the real
// date, so this is how a golden is checked on both sides of a week boundary:
//   LEAGUE_MOCK_DATE=2026-12-01T12:00:00Z ... mocha --require test/global.mjs
// Set at module load so it lands before any test file reads the clock.
if (process.env.LEAGUE_MOCK_DATE) {
  MockDate.set(process.env.LEAGUE_MOCK_DATE)
}

const __dirname = dirname(fileURLToPath(import.meta.url))
const schema_file = process.env.LEAGUE_SCHEMA_FILE
  ? path.resolve(process.env.LEAGUE_SCHEMA_FILE)
  : path.resolve(__dirname, '../db/schema.postgres.sql')

let original_server_close

// A rejection with no listener is otherwise dropped silently, and the case that
// matters is the one that is hardest to read without this: when a test exceeds
// its timeout, mocha fails it and moves on but cannot cancel the queries it
// left in flight, so the real error surfaces later on a promise nobody is
// awaiting. That is how a Postgres unique violation ends up reported as nothing
// more than "Timeout of 2000ms exceeded". Postgres detail (`detail`,
// `constraint`, `table`) lives on the error object rather than in its message,
// so it is printed explicitly.
process.on('unhandledRejection', (reason) => {
  const pg_context = [
    reason?.code && `code=${reason.code}`,
    reason?.constraint && `constraint=${reason.constraint}`,
    reason?.table && `table=${reason.table}`,
    reason?.detail && `detail=${reason.detail}`
  ]
    .filter(Boolean)
    .join(' ')

  console.error(
    '\nUnhandled rejection (may be orphaned work from a timed-out test):',
    reason?.message || reason
  )
  if (pg_context) console.error('  postgres:', pg_context)
  if (reason?.stack) console.error(reason.stack)
})

export async function mochaGlobalSetup() {
  // This function drops every table in the public schema of whatever #db
  // resolved to, and nothing below it asks which database that is. Run the
  // suite with NODE_ENV=development, or with LEAGUE_DB_DATABASE pointed
  // elsewhere, and it would drop production. The guard refuses first, on the
  // live server's own current_database(), and it is the single chokepoint for
  // the whole suite -- every spec's teardown, including the unqualified
  // knex('users').del() ones, runs only after this has passed.
  //
  // The refusal EXITS rather than throwing. A throw out of mochaGlobalSetup
  // leaves the knex pool holding the event loop open, so the run hangs at 0%
  // CPU printing nothing further -- indistinguishable from the four documented
  // suite hangs, and the one shape a session is trained to wait out. Measured:
  // a refusal thrown from here sat until a 180s timeout killed it. Printing and
  // exiting 1 makes the refusal the fastest possible outcome instead.
  try {
    await assert_destructive_target_allowed({
      knex,
      operation: 'test suite setup (DROP TABLE on every table in public)'
    })
  } catch (error) {
    console.error(`\n${error.message}\n`)
    await knex.destroy()
    process.exit(1)
  }

  // Clear all tables in the database
  const tables = await knex.raw(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public'"
  )
  for (const { tablename } of tables.rows) {
    await knex.raw(`DROP TABLE IF EXISTS "${tablename}" CASCADE`)
  }

  // pgcrypto must be present before the schema loads -- the schema relies on
  // gen_random_uuid() defaults (connection_id, job_id) and the find-or-create
  // upsert path for league_scoring_formats / league_formats.
  await knex.raw('CREATE EXTENSION IF NOT EXISTS pgcrypto')

  // Load and execute the schema file
  const sql = await fs.readFile(schema_file, 'utf8')
  await knex.raw(sql)

  // Run seeds
  await knex.seed.run()

  // Ensure default scoring format exists (runs after other seeds to guarantee it's present)
  await scoring_formats_seed(knex)

  // Start the test server once and prevent chai-http from closing it between
  // requests. This eliminates a race condition where server.close() and
  // server.listen(0) overlap, potentially causing intermittent auth failures.
  await new Promise((resolve) => server.listen(0, resolve))
  original_server_close = server.close.bind(server)
  server.close = (cb) => {
    if (cb) cb()
  }
}

export async function mochaGlobalTeardown() {
  if (original_server_close) {
    await new Promise((resolve) => original_server_close(resolve))
  }
}
