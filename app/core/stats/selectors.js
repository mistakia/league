import {
  constants,
  fixTeam,
  calculateDstStatsFromPlays,
  calculateStatsFromPlayStats,
  calculatePoints
} from '@common'
import { getCurrentLeague } from '@core/leagues'
import { getPlaysForPlayer } from '@core/plays'
import { getGamelogByPlayerId } from '@core/gamelogs'
import { getSelectedPlayer } from '@core/players'

export function getStats(state) {
  return state.get('stats')
}

export function getGamelogsForSelectedPlayer(state) {
  const playerMap = getSelectedPlayer(state)
  const gamelogs = []
  for (let week = 1; week <= constants.week; week++) {
    const gamelog = getGamelogForPlayer(state, { playerMap, week })
    if (gamelog) gamelogs.push(gamelog)
  }
  return gamelogs
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
    year: constants.year,
    pos,
    opp,
    ...stats
  })
}
