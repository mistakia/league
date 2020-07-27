const draft = require('../draft')
const league = require('../league')
const users = require('../users')
const matchups = require('../matchups')
const draftPicks = require('../draft-picks')

exports.seed = async function (knex, Promise) {
  try {
    await users(knex)
  } catch (error) {
    console.log(error)
  }

  try {
    await league(knex)
  } catch (error) {
    console.log(error)
  }

  /* try {
   *   await draft(knex)
   * } catch (error) {
   *   console.log(error)
   * }
   */

  try {
    await matchups(knex)
  } catch (error) {
    console.log(error)
  }

  try {
    await draftPicks(knex)
  } catch (error) {
    console.log(error)
  }
}
