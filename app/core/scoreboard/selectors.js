import { List } from 'immutable'
import moment from 'moment-timezone'

import { getStartersByTeamId, getRosterByTeamId } from '@core/rosters'
import { getCurrentLeague } from '@core/leagues'
import {
  constants,
  fixTeam,
  calculateStatsFromPlayStats,
  calculatePoints
} from '@common'
import { getGamelogForPlayer } from '@core/stats'
import { getPlayerById } from '@core/players'
import { getMatchupById } from '@core/matchups'
import { getGameByPlayerId, getGameByTeam } from '@core/schedule'
import { getPlays } from '@core/plays'

export function getScoreboard (state) {
  return state.get('scoreboard')
}

export function getScoreboardRosterByTeamId (state, { tid }) {
  const week = state.getIn(['scoreboard', 'week'])
  return getRosterByTeamId(state, { tid, week })
}

export function getScoreboardByTeamId (state, { tid }) {
  const week = state.getIn(['scoreboard', 'week'])
  const starters = getStartersByTeamId(state, { tid, week })
  let points = 0
  const projected = starters.reduce((sum, player) => {
    const gamelog = getGamelogForPlayer(state, { player, week })
    if (gamelog) points += gamelog.total
    const add = gamelog
      ? gamelog.total
      : player.getIn(['points', `${week}`, 'total'], 0)
    return add + sum
  }, 0)

  return { points, projected }
}

export function getScoreboardUpdated (state) {
  const plays = getPlays(state, { week: constants.season.week })
  const play = plays.maxBy(x => x.updated)
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

  const home = getStartersByTeamId(state, { tid: matchup.hid, week: matchup.week })
  const away = getStartersByTeamId(state, { tid: matchup.aid, week: matchup.week })
  const players = home.concat(away)

  const games = {}
  for (const player of players) {
    if (!player.player) continue
    const game = getGameByTeam(state, { team: player.team, week: matchup.week })
    if (!game) continue
    if (!games[game.date]) games[game.date] = []
    games[game.date].push(player)
  }

  return { matchup, games, home, away }
}

export function getScoreboardGamelogByPlayerId (state, { playerId }) {
  const player = getPlayerById(state, { playerId })

  if (!player.player) return

  const week = state.getIn(['scoreboard', 'week'])
  return getGamelogForPlayer(state, { player, week })
}

export function getPlaysByMatchupId (state, { mid }) {
  const matchup = getMatchupById(state, { mid })
  if (!matchup) return new List()

  const homeStarters = getStartersByTeamId(state, { tid: matchup.hid, week: matchup.week })
  const awayStarters = getStartersByTeamId(state, { tid: matchup.aid, week: matchup.week })
  const players = homeStarters.concat(awayStarters)
  const gsisids = players.map(p => p.gsisid).filter(Boolean)
  if (!gsisids.length) return new List()

  const gsispids = players.map(p => p.gsispid).filter(Boolean)

  const plays = getPlays(state, { week: matchup.week })
  // TODO - match/filter dst plays
  const filteredPlays = plays.valueSeq().toList().filter(p => {
    const matchSingleGsis = p.playStats.find(p => gsisids.includes(p.gsisId))
    if (matchSingleGsis) return true

    const matchSingleGsisPid = p.playStats.find(p => gsispids.includes(p.gsispid))
    return !!matchSingleGsisPid
  })

  const league = getCurrentLeague(state)
  let result = new List()
  for (const play of filteredPlays) {
    const game = getGameByTeam(state, { team: fixTeam(play.possessionTeam), week: matchup.week })
    // TODO - calculate dst stats and points
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
        position: player.pos,
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

function getYardline (str, possessionTeam) {
  if (str === '50') {
    return 50
  }

  const re = /([A-Z]*)\s([1-9]*)/i
  const results = str.match(re)
  const yardlineSide = results[1]
  const yardlineNumber = parseInt(results[2], 10)

  return yardlineSide === possessionTeam
    ? yardlineNumber
    : (100 - yardlineNumber)
}

export function getGameStatusByPlayerId (state, { playerId, week = constants.season.week }) {
  const game = getGameByPlayerId(state, { playerId, week })
  if (!game) {
    return null
  }

  const plays = getPlays(state, { week })
  const player = getPlayerById(state, { playerId })
  const play = plays.find(p => {
    if (!p.possessionTeam) return false

    const team = fixTeam(p.possessionTeam)
    return team === game.h || team === game.v
  })

  if (!play) {
    return { game }
  }

  const filteredPlays = plays.filter(p => p.esbid === play.esbid)
  const lastPlay = filteredPlays.maxBy(p => p.playId)
  if (!lastPlay.possessionTeam) {
    return { game, lastPlay }
  }

  const hasPossession = fixTeam(lastPlay.possessionTeam) === player.team
  const yardline = getYardline(lastPlay.endYardLine || lastPlay.startYardLine, lastPlay.possessionTeam)
  const isRedzone = yardline >= 80

  return {
    game,
    lastPlay,
    yardline,
    isRedzone,
    hasPossession
  }
}
