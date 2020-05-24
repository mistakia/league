const path = require('path')
const fs = require('fs').promises

const schemaFile = path.resolve(__dirname, '../schema.sql')

exports.up = async function(knex) {
  const sql = await fs.readFile(schemaFile, 'utf8')
  return knex.raw(sql)
}

exports.down = async function(knex) {
  const sql = await fs.readFile(schemaFile, 'utf8')
  return knex.raw(sql)
}
