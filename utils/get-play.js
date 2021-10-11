const db = require('../db')

const { fixTeam } = require('../common')

module.exports = async ({
  wk,
  seas,
  off,
  def,

  qtr,
  dwn,
  type,
  yardlineNumber,
  yardlineSide
}) => {
  const query = db('nflPlay')

  if (wk) {
    query.where({ wk })
  }

  if (seas) {
    query.where({ seas })
  }

  if (off) {
    query.where({ off: fixTeam(off) })
  }

  if (def) {
    query.where({ def: fixTeam(def) })
  }

  if (qtr) {
    query.where({ qtr: parseInt(qtr, 10) })
  }

  if (dwn) {
    query.where({ dwn: parseInt(dwn, 10) })
  }

  if (type) {
    query.where({ type })
  }

  if (yardlineNumber) {
    query.where({ yardlineNumber })
  }

  if (yardlineSide) {
    query.where({ yardlineSide: fixTeam(yardlineSide) })
  }

  const plays = await query
  if (plays.length === 1) {
    return plays[0]
  } else {
    return null
  }
}
