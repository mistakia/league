import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone.js'
import db from '#db'
import { constants } from '#libs-shared'

dayjs.extend(timezone)

export default async function (pid) {
  if (constants.season.week === 0) {
    return false
  }

  const player_rows = await db('player')
    .select('player.*', 'nfl_games.date', 'nfl_games.time_est')
    .where({ pid })
    .joinRaw(
      'left join nfl_games on player.cteam = nfl_games.v or player.cteam = nfl_games.h'
    )
    .where('nfl_games.week', constants.season.week)
    .where('nfl_games.year', constants.season.year)
    .where('nfl_games.seas_type', 'REG')
    .limit(1)

  const player_row = player_rows[0]

  if (!player_row) {
    return false
  }

  // TODO - fix check to exclude any players who have become inactive after the game
  /* if (player_row.status === 'Inactive') {
   *   return false
   * }
   */

  const gameStart = dayjs.tz(
    `${player_row.date} ${player_row.time_est}`,
    'YYYY/MM/DD HH:mm:SS',
    'America/New_York'
  )
  if (dayjs().isAfter(gameStart)) {
    return true
  }

  return false
}
