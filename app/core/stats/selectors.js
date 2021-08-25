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
  const player = getSelectedPlayer(state)
  const gamelogs = []
  for (let week = 1; week <= constants.season.week; week++) {
    const gamelog = getGamelogForPlayer(state, { player, week })
    if (gamelog) gamelogs.push(gamelog)
  }
  return gamelogs
}

export function getGamelogForPlayer(state, { player, week }) {
  if (!player || !player.player) return null

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

  const gamelog = getGamelogByPlayerId(state, { playerId: player.player, week })
  if (gamelog) return process(gamelog)

  const plays = getPlaysForPlayer(state, { player, week }).toJS()
  if (!plays.length) return null

  const { pos } = player
  const stats =
    pos === 'DST'
      ? calculateDstStatsFromPlays(plays, player.team)
      : calculateStatsFromPlayStats(plays.flatMap((p) => p.playStats))
  const play = plays.find((p) => p.possessionTeam)
  const opp = play
    ? fixTeam(play.possessionTeam) === fixTeam(play.h)
      ? fixTeam(play.v)
      : fixTeam(play.h)
    : null

  return process({
    player: player.player,
    week,
    year: constants.season.year,
    pos,
    opp,
    ...stats
  })
}
