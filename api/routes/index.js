const auth = require('./auth')
const me = require('./me')
const teams = require('./teams')
const players = require('./players')
const leagues = require('./leagues')
const sources = require('./sources')
const plays = require('./plays')
const projections = require('./projections')
const settings = require('./settings')
const stats = require('./stats')

module.exports = {
  auth,
  teams,
  leagues,
  players,
  me,
  sources,
  settings,
  plays,
  projections,
  stats
}
