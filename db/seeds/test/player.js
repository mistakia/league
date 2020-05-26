const path = require('path')
const fs = require('fs').promises

const sqlFile = path.resolve(__dirname, './player.sql')

exports.seed = async function (knex, Promise) {
  await knex('player').del()

  const sql = await fs.readFile(sqlFile, 'utf8')
  return knex.raw(sql)
}
