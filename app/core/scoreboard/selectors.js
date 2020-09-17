import { List } from 'immutable'
import moment from 'moment-timezone'

import { getStartersByTeamId, getRosterByTeamId } from '@core/rosters'
import { getCurrentLeague } from '@core/leagues'
import {
  fixTeam,
  calculateStatsFromPlayStats,
  calculatePoints,
  calculateDstStatsFromPlays,
  calculateDstPoints
} from '@common'
import { getPlayerById } from '@core/players'
import { getMatchupById } from '@core/matchups'
import { getGameByPlayerId, getGameByTeam } from '@core/schedule'

export function getScoreboard (state) {
  return state.get('scoreboard')
}

export function getScoreboardRosterByTeamId (state, { tid }) {
  const week = state.getIn(['scoreboard', 'week'])
  return getRosterByTeamId(state, { tid, week })
}

function getStatsForPlayer (state, { player }) {
  const plays = state.getIn(['scoreboard', 'plays'])
  const week = state.getIn(['scoreboard', 'week'])
  // TODO - filter deleted plays
  const currentWeekPlays = plays.filter(p => p.week === week)

  if (player.pos1 === 'DST') {
    const game = getGameByPlayerId(state, { playerId: player.player, week })
    const opponent = game.h === player.team ? game.v : game.h

    const opponentPlays = currentWeekPlays
      .valueSeq()
      .toList()
      .filter(p => p.possessionTeam && fixTeam(p.possessionTeam) === opponent)

    const playStats = opponentPlays.flatMap(p => p.playStats)
    const stats = calculateDstStatsFromPlays(opponentPlays.toJS())
    const points = calculateDstPoints(stats)
    return { playStats: playStats.toJS(), points, stats }
  }

  const playStats = currentWeekPlays.valueSeq().toList().flatMap(p => {
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

export function getScoreboardByTeamId (state, { tid }) {
  const starters = getStartersByTeamId(state, { tid })
  let points = 0
  const week = state.getIn(['scoreboard', 'week'])
  const projected = starters.reduce((sum, player) => {
    const playerScoreboard = getStatsForPlayer(state, { player })
    if (playerScoreboard) points += playerScoreboard.points.total
    const add = playerScoreboard
      ? playerScoreboard.points.total
      : player.getIn(['points', `${week}`, 'total'], 0)
    return add + sum
  }, 0)

  return { points, projected }
}

export function getScoreboardUpdated (state) {
  const scoreboard = getScoreboard(state)
  const plays = scoreboard.get('plays')
  const week = scoreboard.get('week')
  const currentWeekPlays = plays.filter(p => p.week === week)
  const play = currentWeekPlays.maxBy(x => x.updated)
  return play ? play.updated : 0
}

export function getStartersByMatchupId (state, { mid }) {
  const matchup = getMatchupById(state, { mid })
  if (!matchup) {
    return {
      matchup: {},
      games: {},
      home: [],
      away: []
    }
  }

  const home = getStartersByTeamId(state, { tid: matchup.hid })
  const away = getStartersByTeamId(state, { tid: matchup.aid })
  const players = home.concat(away)

  const games = {}
  for (const player of players) {
    if (!player.player) continue
    const game = getGameByTeam(state, { team: fixTeam(player.team), week: matchup.week })
    if (!games[game.date]) games[game.date] = []
    games[game.date].push(player)
  }

  return { matchup, games, home, away }
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
    if (p.week !== matchup.week) return false

    const matchSingleGsis = p.playStats.find(p => gsisids.includes(p.gsisId))
    if (matchSingleGsis) return true

    const matchSingleGsisPid = p.playStats.find(p => gsispids.includes(p.gsispid))
    return !!matchSingleGsisPid
  })

  const league = getCurrentLeague(state)
  let result = new List()
  for (const play of filteredPlays) {
    const game = getGameByTeam(state, { team: fixTeam(play.possessionTeam), week: matchup.week })
    const playStats = play.playStats.filter(p => p.gsispid)
    const grouped = {}
    for (const playStat of playStats) {
      const player = players.find(p => {
        if (p.gsispid && p.gsispid === playStat.gsispid) return true
        if (p.gsisid && p.gsisid === playStat.gsisId) return true
        return false
      })
      if (!player) continue
      if (!grouped[player.player]) grouped[player.player] = []
      grouped[player.player].push(playStat)
    }
    const points = {}
    const stats = {}
    for (const playerId in grouped) {
      const player = players.find(p => p.player === playerId)
      const playStats = grouped[playerId]
      stats[playerId] = calculateStatsFromPlayStats(playStats)
      points[playerId] = calculatePoints({
        stats: stats[playerId],
        position: player.pos1,
        league
      })
      points[playerId].isHomePlayer = !!homeStarters.find(p => p.player === playerId)
    }
    const date = moment.tz(game.date, 'M/D/YYYY HH:mm', 'America/New_York')
    const time = moment.utc(`${date.utc().format('YYYY-MM-DD')} ${play.timeOfDay}`, 'YYYY-MM-DD HH:mm:ss')
    result = result.push({
      time: time.unix(),
      play,
      game,
      stats,
      points
    })
  }

  return result.sort((a, b) => b.time - a.time)
}
