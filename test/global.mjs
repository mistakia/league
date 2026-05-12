import knex from '#db'
import path, { dirname } from 'path'
import fs from 'fs/promises'
import { fileURLToPath } from 'url'
import scoring_formats_seed from '#db/fixtures/scoring-formats.mjs'
import server from '#api'

const __dirname = dirname(fileURLToPath(import.meta.url))
const schema_file = path.resolve(__dirname, '../db/schema.postgres.sql')

let original_server_close

export async function mochaGlobalSetup() {
  // Clear all tables in the database
  const tables = await knex.raw(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public'"
  )
  for (const { tablename } of tables.rows) {
    await knex.raw(`DROP TABLE IF EXISTS "${tablename}" CASCADE`)
  }

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
