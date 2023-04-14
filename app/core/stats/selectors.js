import {
  constants,
  fixTeam,
  calculateDstStatsFromPlays,
  calculateStatsFromPlayStats,
  calculatePoints
} from '@common'
import { getCurrentLeague } from '@core/leagues'
import { getPlaysForPlayer } from '@core/plays'
import { getPlayerGamelogs, getGamelogByPlayerId } from '@core/gamelogs'
import { getSelectedPlayer } from '@core/players'

export function getStats(state) {
  return state.get('stats')
}

export function getGamelogsForSelectedPlayer(state) {
  const playerMap = getSelectedPlayer(state)
  const gamelogs = getPlayerGamelogs(state)
  const pid = playerMap.get('pid')
  const games = gamelogs
    .filter((p) => p.pid === pid)
    .sort((a, b) => b.timestamp - a.timestamp)
  return games.toJS()
}

export function getGamelogForPlayer(
  state,
  { playerMap, week, year = constants.year }
) {
  if (!playerMap || !playerMap.get('pid')) return null

  const league = getCurrentLeague(state)

  const process = (gamelog) => {
    const points = calculatePoints({
      stats: gamelog,
      position: gamelog.pos,
      league
    })

    return {
      points,
      total: points.total,
      ...gamelog
    }
  }

  const pid = playerMap.get('pid')
  const gamelog = getGamelogByPlayerId(state, { pid, week, year })
  if (gamelog) return process(gamelog)

  // TODO should handle year
  const plays = getPlaysForPlayer(state, { playerMap, week }).toJS()
  if (!plays.length) return null

  const pos = playerMap.get('pos')
  const stats =
    pos === 'DST'
      ? calculateDstStatsFromPlays(plays, playerMap.get('team'))
      : calculateStatsFromPlayStats(plays.flatMap((p) => p.playStats))
  const play = plays.find((p) => p.possessionTeam)
  const opp = play
    ? fixTeam(play.possessionTeam) === fixTeam(play.h)
      ? fixTeam(play.v)
      : fixTeam(play.h)
    : null

  return process({
    pid,
    week,
    year,
    pos,
    opp,
    ...stats
  })
}
