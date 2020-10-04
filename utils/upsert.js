const db = require('../db')

const upsert = async (table, data) => {
  const insert = db(table).insert(data).toString()
  const update = db(table).update(data).toString().replace(/^update .* set /i, '')
  return db.raw(insert + ' on duplicate key update ' + update)
}

module.exports = upsert
