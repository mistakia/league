import { List } from 'immutable'

import { getStartersByTeamId } from '@core/rosters'
import { getCurrentLeague } from '@core/leagues'
import {
  constants,
  fixTeam,
  calculateStatsFromPlayStats,
  calculatePoints,
  calculateDstStatsFromPlayStats,
  calculateDstPoints
} from '@common'
import { getPlayerById } from '@core/players'
import { getMatchupById } from '@core/matchups'
import { getGameForWeekByPlayerId } from '@core/schedule'

function getStatsForPlayer (state, { player }) {
  const plays = state.getIn(['scoreboard', 'plays'])

  if (player.pos1 === 'DST') {
    const game = getGameForWeekByPlayerId(state, { playerId: player.player })
    const opponent = game.h === player.team ? game.v : game.h

    const playStats = plays.valueSeq().toList().flatMap(p => {
      if (!p.possessionTeam) return []

      if (fixTeam(p.possessionTeam) !== opponent) return []

      return p.playStats
    })

    const stats = calculateDstStatsFromPlayStats(playStats.toJS())
    const points = calculateDstPoints(stats)
    return { playStats: playStats.toJS(), points, stats }
  }

  const playStats = plays.valueSeq().toList().flatMap(p => {
    if (!p.possessionTeam) return []

    // ignore plays by other teams
    if (fixTeam(p.possessionTeam) !== player.team) return []

    return p.playStats.filter(ps => (ps.gsisId && ps.gsisId === player.gsisid) || (ps.gsispid && ps.gsispid === player.gsispid))
  })

  if (!playStats.size) return
  const league = getCurrentLeague(state)

  const stats = calculateStatsFromPlayStats(playStats.toJS())
  const points = calculatePoints({ stats, position: player.pos1, league })

  if (player.pos1 === 'K') {
    stats.fgs = []
    stats.fga = 0
    stats.fgm = 0
    stats.xpa = 0
    stats.xpm = 0
    for (const playStat of playStats) {
      switch (playStat.statId) {
        case 69:
          stats.fga += 1
          break

        case 70:
          stats.fga += 1
          stats.fgm += 1
          stats.fgs.push(playStat.yards)
          break

        case 72:
          stats.xpa += 1
          stats.xpm += 1
          break

        case 73:
          stats.xpa += 1
          break
      }
    }

    points.xp = (stats.xpm * 1)
    points.fg = stats.fgs.reduce((sum, fg) => sum + Math.max(fg / 10, 3), 0)
    points.total = points.total + points.xp + points.fg
  }

  return { playStats: playStats.toJS(), points, stats }
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
  const play = plays.maxBy(x => x.updated)
  return play ? play.updated : 0
}

export function getStatsByPlayerId (state, { playerId }) {
  const player = getPlayerById(state, { playerId })

  if (!player.player) return

  return getStatsForPlayer(state, { player })
}

export function getPlaysByMatchupId (state, { mid }) {
  const matchup = getMatchupById(state, { mid })
  if (!matchup) return new List()

  const homeStarters = getStartersByTeamId(state, { tid: matchup.hid })
  const awayStarters = getStartersByTeamId(state, { tid: matchup.aid })
  const players = homeStarters.concat(awayStarters)
  const gsisids = players.map(p => p.gsisid).filter(Boolean)
  if (!gsisids.length) return new List()

  const gsispids = players.map(p => p.gsispid).filter(Boolean)

  const plays = state.getIn(['scoreboard', 'plays'])
  const filteredPlays = plays.valueSeq().toList().filter(p => {
    const matchSingleGsis = p.playStats.find(p => gsisids.includes(p.gsisId))
    if (matchSingleGsis) return true

    const matchSingleGsisPid = p.playStats.find(p => gsispids.includes(p.gsispid))
    return !!matchSingleGsisPid
  })

  const sortedPlays = filteredPlays.sort((a, b) => b.timeOfDay - a.timeOfDay)

  // TODO
  // calculate points for each play

  return sortedPlays
}
