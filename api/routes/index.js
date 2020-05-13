const auth = require('./auth')
const me = require('./me')
const teams = require('./teams')
const transactions = require('./transactions')
const players = require('./players')
const games = require('./games')
const settings = require('./settings')

module.exports = {
  auth,
  teams,
  transactions,
  players,
  games,
  settings,
  me
}
