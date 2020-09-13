import { getStartersByTeamId } from '@core/rosters'
import { getCurrentLeague } from '@core/leagues'
import { constants, fixTeam, calculateStatsFromPlayStats, calculatePoints } from '@common'
import { getPlayerById } from '@core/players'

function getStatsForPlayer (state, { player }) {
  const plays = state.getIn(['scoreboard', 'plays'])

  // TODO - dst
  const playStats = plays.valueSeq().toList().flatMap(p => {
    if (!p.possessionTeam) return []

    // ignore plays by other teams
    if (fixTeam(p.possessionTeam) !== player.team) return []

    return p.playStats.filter(ps => ps.gsisId === player.gsisid)
  })

  if (!playStats.size) return
  const league = getCurrentLeague(state)
  const stats = calculateStatsFromPlayStats(playStats.toJS())
  const points = calculatePoints({ stats, position: player.pos1, league })

  return { points, stats }
}

export function getScoreboard (state) {
  return state.get('scoreboard')
}

export function getScoreboardByTeamId (state, { tid }) {
  const starters = getStartersByTeamId(state, { tid })
  let points = 0
  const projected = starters.reduce((sum, player) => {
    const playerScoreboard = getStatsForPlayer(state, { player })
    if (playerScoreboard) points += playerScoreboard.points.total
    const add = playerScoreboard
      ? playerScoreboard.points.total
      : player.getIn(['points', `${constants.season.week}`, 'total'], 0)
    return add + sum
  }, 0)

  return { points, projected }
}

export function getScoreboardUpdated (state) {
  const scoreboard = getScoreboard(state)
  const plays = scoreboard.get('plays')
  const play = plays.minBy(x => x.updated)
  return play ? play.updated : 0
}

export function getStatsByPlayerId (state, { playerId }) {
  const player = getPlayerById(state, { playerId })

  if (!player.player) return

  return getStatsForPlayer(state, { player })
}
