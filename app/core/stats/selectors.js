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

export function getStats (state) {
  return state.get('stats')
}

export function getGamelogForPlayer (state, { player, week }) {
  // TODO - check gamelogs store

  if (!player || !player.player) return null

  const league = getCurrentLeague(state)

  const process = (gamelog) => {
    const points = calculatePoints({ stats: gamelog, position: gamelog.pos, league })

    return {
      points,
      total: points.total,
      ...gamelog
    }
  }

  const gamelog = getGamelogByPlayerId(state, { playerId: player.player, week })
  if (gamelog) return process(gamelog)

  const plays = getPlaysForPlayer(state, { player, week }).toJS()
  const { pos } = player
  const stats = pos === 'DST'
    ? calculateDstStatsFromPlays(plays, player.team)
    : calculateStatsFromPlayStats(plays.flatMap(p => p.playStats))
  const play = plays.find(p => p.possessionTeam)
  const opp = play ? (fixTeam(play.possessionTeam) === fixTeam(play.homeTeamAbbr)
    ? fixTeam(play.awayTeamAbbr)
    : fixTeam(play.homeTeamAbbr)) : null

  return process({
    player: player.player,
    week,
    year: constants.season.year,
    pos,
    opp,
    ...stats
  })
}
