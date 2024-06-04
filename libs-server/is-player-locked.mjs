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
      'left join nfl_games on player.current_nfl_team = nfl_games.v or player.current_nfl_team = nfl_games.h'
    )
    .where('nfl_games.week', constants.season.week)
    .where('nfl_games.year', constants.season.year)
    .where('nfl_games.seas_type', 'REG')
    .limit(1)

  const player_row = player_rows[0]

  if (!player_row) {
    return false
  }

  const gameStart = dayjs.tz(
    `${player_row.date} ${player_row.time_est}`,
    'YYYY/MM/DD HH:mm:SS',
    'America/New_York'
  )

  if (dayjs().isAfter(gameStart)) {
    if (player_row.nfl_status === constants.player_nfl_status.INACTIVE) {
      // check player statuses leading up to the game
      const players_status_rows = await db('players_status')
        .select('players_status.*')
        .where({ pid })
        .whereBetween('timestamp', [
          dayjs(gameStart).subtract(5, 'day').unix(),
          dayjs(gameStart).unix()
        ])

      // if the player was Inactive prior to the game, then they are not locked
      const player_formatted_statuses = players_status_rows.map(
        (row) => row.formatted_status
      )
      if (
        player_formatted_statuses.includes(constants.player_nfl_status.INACTIVE)
      ) {
        return false
      }
    }

    return true
  }

  return false
}
