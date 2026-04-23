import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone.js'
import db from '#db'
import { current_season, player_nfl_status } from '#constants'
import apply_nfl_games_current_week_join from './data-views/join-nfl-games-current-week.mjs'

dayjs.extend(timezone)

export default async function (pid) {
  if (current_season.isOffseason) {
    return false
  }

  const query = db('player')
    .select('player.*', 'nfl_games.date', 'nfl_games.time_est')
    .where({ pid })
  apply_nfl_games_current_week_join({ db, query })
  const player_rows = await query.whereNotNull('nfl_games.esbid').limit(1)

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
    if (player_row.roster_status === player_nfl_status.INACTIVE) {
      // check player statuses leading up to the game
      const players_status_rows = await db('players_status')
        .select('players_status.*')
        .where({ pid })
        .whereBetween('timestamp', [
          dayjs(gameStart).subtract(5, 'day').unix(),
          dayjs(gameStart).unix()
        ])

      // if the player was Inactive prior to the game, then they are not locked
      const player_roster_statuses = players_status_rows.map(
        (row) => row.roster_status
      )
      if (player_roster_statuses.includes(player_nfl_status.INACTIVE)) {
        return false
      }
    }

    return true
  }

  return false
}
