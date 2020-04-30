const groupBy = (xs, key) => xs.reduce((rv, x) => {
  (rv[x[key]] = rv[x[key]] || []).push(x)
  return rv
}, {})


module.exports.calculatePoints = require('./calculate-points')
module.exports.normalizePlayerName = require('./normalize-player-name')
module.exports.groupBy = groupBy
