const path = require('path')
const fs = require('fs').promises

const sqlFile = path.resolve(__dirname, './draft-rankings.sql')

exports.seed = async function (knex, Promise) {
  await knex('rankings').del()

  const sql = await fs.readFile(sqlFile, 'utf8')
  return knex.raw(sql)
}
