const db = require('../db')

module.exports = async (tid) => {
  const teams = await db('teams').where({ uid: tid })
  return teams[0]
}
