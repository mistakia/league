const dayjs = require('dayjs')
const timezone = require('dayjs/plugin/timezone')
const db = require('../db')
const { constants } = require('../common')

dayjs.extend(timezone)

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

  const gameStart = dayjs.tz(playerRow.date, 'M/D/YYYY H:m', 'America/New_York')
  if (dayjs().isAfter(gameStart)) {
    return true
  }

  return false
}
