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

export function getGamelogForPlayer(state, { playerMap, week }) {
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
  const gamelog = getGamelogByPlayerId(state, { pid, week })
  if (gamelog) return process(gamelog)

  const plays = getPlaysForPlayer(state, { playerMap, week }).toJS()
  if (!plays.length) return null

  const pos = playerMap.get('pos')
  const stats =
    pos === 'DST'
      ? calculateDstStatsFromPlays(plays, playerMap.get('team'))
      : calculateStatsFromPlayStats(plays.flatMap((p) => p.play_stats))
  const play = plays.find((p) => p.possessionTeam)
  const opp = play
    ? fixTeam(play.possessionTeam) === fixTeam(play.h)
      ? fixTeam(play.v)
      : fixTeam(play.h)
    : null

  return process({
    pid,
    week,
    year: constants.year,
    pos,
    opp,
    ...stats
  })
}
