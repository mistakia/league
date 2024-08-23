import knex from '#db'
import path, { dirname } from 'path'
import fs from 'fs/promises'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const schema_file = path.resolve(__dirname, '../db/schema.postgres.sql')

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
}
