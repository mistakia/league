const auth = require('./auth')
const me = require('./me')
const teams = require('./teams')
const players = require('./players')
const leagues = require('./leagues')
const sources = require('./sources')
const plays = require('./plays')

module.exports = {
  auth,
  teams,
  leagues,
  players,
  me,
  sources,
  plays
}
