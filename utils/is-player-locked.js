const dayjs = require('dayjs')
const db = require('../db')
const { constants } = require('../common')

module.exports = async (player) => {
  if (constants.season.week === 0) {
    return false
  }

  const players = await db('player')
    .where({ player })
    .joinRaw(
      'left join schedule on player.cteam = schedule.v or player.cteam = schedule.h'
    )
    .where('schedule.wk', constants.season.week)
    .where('schedule.seas', constants.season.year)
    .limit(1)

  const playerRow = players[0]

  if (!playerRow) {
    return false
  }

  const gameStart = dayjs(playerRow.date, 'M/D/YYYY H:m')
  if (dayjs().isAfter(gameStart)) {
    return true
  }

  return false
}
