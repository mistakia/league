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
      'left join nfl_games on player.cteam = nfl_games.v or player.cteam = nfl_games.h'
    )
    .where('nfl_games.wk', constants.season.week)
    .where('nfl_games.seas', constants.season.year)
    .limit(1)

  const playerRow = players[0]

  if (!playerRow) {
    return false
  }

  const gameStart = dayjs.tz(
    `${playerRow.date} ${playerRow.time_est}`,
    'YYYY/MM/DD HH:mm:SS',
    'America/New_York'
  )
  if (dayjs().isAfter(gameStart)) {
    return true
  }

  return false
}
