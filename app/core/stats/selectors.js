import {
  constants,
  fixTeam,
  calculateDstStatsFromPlays,
  calculateStatsFromPlayStats,
  calculatePoints
} from '@common'
import { getCurrentLeague } from '@core/leagues'
import { getPlaysForPlayer } from '@core/plays'

export function getStats (state) {
  return state.get('stats')
}

export function getGamelogForPlayer (state, { player, week }) {
  // TODO
  /* const gamelog = player.get('gamelogs')
   *   .filter(g => g.year === constants.season.year && g.week === week)
   * if (gamelog) {
   *   return gamelog
   * } */

  if (!player || !player.player) return null

  const league = getCurrentLeague(state)
  const plays = getPlaysForPlayer(state, { player, week }).toJS()
  const pos = player.pos1
  const stats = pos === 'DST'
    ? calculateDstStatsFromPlays(plays, player.team)
    : calculateStatsFromPlayStats(plays.flatMap(p => p.playStats))
  const play = plays.find(p => p.possessionTeam)
  const opp = play ? (fixTeam(play.possessionTeam) === fixTeam(play.homeTeamAbbr)
    ? fixTeam(play.awayTeamAbbr)
    : fixTeam(play.homeTeamAbbr)) : null
  const points = calculatePoints({ stats, position: pos, league })

  return {
    player: player.player,
    week,
    year: constants.season.year,
    points,
    total: points.total,
    pos,
    opp,
    ...stats
  }
}
