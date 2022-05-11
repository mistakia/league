import path, { dirname } from 'path'
import fs from 'fs/promises'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const schemaFile = path.resolve(__dirname, '../schema.sql')

export async function up(knex) {
  const sql = await fs.readFile(schemaFile, 'utf8')
  return knex.raw(sql)
}

export async function down(knex) {
  const sql = await fs.readFile(schemaFile, 'utf8')
  return knex.raw(sql)
}
