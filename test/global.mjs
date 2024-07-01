import knex from '#db'
import path, { dirname } from 'path'
import fs from 'fs/promises'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const schema_file = path.resolve(__dirname, '../db/schema.postgres.sql')

export async function mochaGlobalSetup() {
  const sql = await fs.readFile(schema_file, 'utf8')
  await knex.raw(sql)

  await knex.seed.run()
}
