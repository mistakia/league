import { List } from 'immutable'
import dayjs from 'dayjs'

import { getStartersByTeamId, getRosterByTeamId } from '@core/rosters'
import { getCurrentLeague } from '@core/leagues'
import {
  constants,
  fixTeam,
  calculateStatsFromPlayStats,
  calculatePoints,
  getYardlineInfoFromString
} from '@common'
import { getGamelogForPlayer } from '@core/stats'
import { getPlayerById } from '@core/players'
import { getSelectedMatchup } from '@core/matchups'
import { getGameByPlayerId, getGameByTeam } from '@core/schedule'
import { getPlays } from '@core/plays'

export function getScoreboard(state) {
  return state.get('scoreboard')
}

export function getScoreboardRosterByTeamId(state, { tid }) {
  const week = state.getIn(['scoreboard', 'week'])
  return getRosterByTeamId(state, { tid, week })
}

export function getSelectedMatchupScoreboards(state) {
  const matchup = getSelectedMatchup(state)
  const week = state.getIn(['scoreboard', 'week'])
  return matchup.tids.map((tid) => ({
    tid,
    ...getScoreboardByTeamId(state, { tid, week })
  }))
}

export function getPointsByTeamId(state, { tid, week }) {
  let points = 0
  const starters = getStartersByTeamId(state, { tid, week })
  starters.forEach((player) => {
    const gamelog = getGamelogForPlayer(state, { player, week })
    if (gamelog) points += gamelog.total
  })
  return points
}

export function getScoreboardByTeamId(state, { tid }) {
  const week = state.getIn(['scoreboard', 'week'])
  const isChampRound = week === constants.season.finalWeek
  let points = isChampRound
    ? getPointsByTeamId(state, { tid, week: constants.season.finalWeek - 1 })
    : 0
  const previousWeek = points
  let minutes = 0

  const starters = getStartersByTeamId(state, { tid, week })
  const projected = starters.reduce((sum, player) => {
    const gamelog = getGamelogForPlayer(state, { player, week })
    if (gamelog) {
      points += gamelog.total
      const gameStatus = getGameStatusByPlayerId(state, {
        playerId: player.player,
        week
      })
      if (gameStatus && gameStatus.lastPlay) {
        const lp = gameStatus.lastPlay
        const quarterMinutes =
          lp.desc === 'END GAME'
            ? 0
            : parseInt((lp.game_clock_start || '').split(':').pop(), 10) // TODO - double check
        const quartersRemaining = lp.qtr === 5 ? 0 : 4 - lp.qtr
        minutes += quartersRemaining * 15 + quarterMinutes
      }
    } else {
      minutes += 60
    }
    const add = gamelog
      ? gamelog.total
      : player.getIn(['points', `${week}`, 'total'], 0)
    return add + sum
  }, 0)

  return { points, projected: projected + previousWeek, minutes }
}

export function getScoreboardUpdated(state) {
  const plays = getPlays(state, { week: constants.season.week })
  const play = plays.maxBy((x) => x.updated)
  return play ? play.updated : 0
}

export function getStartersByMatchupId(state, { mid }) {
  const matchup = getSelectedMatchup(state)
  if (!matchup) {
    return {
      matchup: {},
      games: {},
      teams: []
    }
  }

  const teams = {}
  matchup.tids.forEach((tid) => {
    teams[tid] = getStartersByTeamId(state, { tid, week: matchup.week })
  })
  const players = Object.values(teams).flat()

  const games = {}
  for (const player of players) {
    if (!player.player) continue
    const game = getGameByTeam(state, { team: player.team, week: matchup.week })
    if (!game) continue
    const dateStr = `${game.date} ${game.time_est}`
    if (!games[dateStr]) games[dateStr] = []
    games[dateStr].push(player)
  }

  return { matchup, games, teams }
}

export function getScoreboardGamelogByPlayerId(state, { playerId }) {
  const player = getPlayerById(state, { playerId })

  if (!player.player) return

  const week = state.getIn(['scoreboard', 'week'])
  return getGamelogForPlayer(state, { player, week })
}

export function getPlaysByMatchupId(state, { mid }) {
  const matchup = getSelectedMatchup(state)
  if (!matchup) return new List()

  const players = matchup.tids.reduce((arr, tid) => {
    const starters = getStartersByTeamId(state, { tid, week: matchup.week })
    return arr.concat(starters)
  }, [])
  const gsisids = players.map((p) => p.gsisid).filter(Boolean)
  if (!gsisids.length) return new List()

  const gsispids = players.map((p) => p.gsispid).filter(Boolean)

  const plays = getPlays(state, { week: matchup.week })
  // TODO - match/filter dst plays
  const filteredPlays = plays
    .valueSeq()
    .toList()
    .filter((p) => {
      if (!p.playStats) return false

      const matchSingleGsis = p.playStats.find((p) =>
        gsisids.includes(p.gsisId)
      )
      if (matchSingleGsis) return true

      const matchSingleGsisPid = p.playStats.find((p) =>
        gsispids.includes(p.gsispid)
      )
      return Boolean(matchSingleGsisPid)
    })

  const league = getCurrentLeague(state)
  let result = new List()
  for (const play of filteredPlays) {
    const game = getGameByTeam(state, {
      team: fixTeam(play.pos_team),
      week: matchup.week
    })

    if (!game) continue

    // TODO - calculate dst stats and points
    const playStats = play.playStats.filter((p) => p.gsispid)
    const grouped = {}
    for (const playStat of playStats) {
      const player = players.find((p) => {
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
      const player = players.find((p) => p.player === playerId)
      const playStats = grouped[playerId]
      stats[playerId] = calculateStatsFromPlayStats(playStats)
      points[playerId] = calculatePoints({
        stats: stats[playerId],
        position: player.pos,
        league
      })
    }
    const date = dayjs.tz(
      `${game.date} ${game.time_est}`,
      'YYYY/MM/DD HH:mm:SS',
      'America/New_York'
    )
    const time = dayjs.utc(
      `${date.utc().format('YYYY-MM-DD')} ${play.timestamp}`,
      'YYYY-MM-DD HH:mm:ss'
    )
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

function getYardline(str, pos_team) {
  if (!str) {
    return ''
  }

  if (str === '50') {
    return 50
  }

  const { side, number } = getYardlineInfoFromString(str)
  return side === pos_team ? number : 100 - number
}

export function getGameStatusByPlayerId(
  state,
  { playerId, week = constants.season.week }
) {
  const game = getGameByPlayerId(state, { playerId, week })
  if (!game) {
    return null
  }

  const plays = getPlays(state, { week })
  const player = getPlayerById(state, { playerId })
  const play = plays.find((p) => {
    if (!p.pos_team) return false

    const team = fixTeam(p.pos_team)
    return team === game.h || team === game.v
  })

  if (!play) {
    return { game }
  }

  const filteredPlays = plays.filter((p) => p.esbid === play.esbid && p.desc)
  const lastPlay = filteredPlays.maxBy((p) => p.sequence)
  if (!lastPlay.pos_team) {
    return { game, lastPlay }
  }

  const hasPossession = fixTeam(lastPlay.pos_team) === player.team
  const yardline = getYardline(
    lastPlay.ydl_end || lastPlay.ydl_start,
    lastPlay.pos_team
  )
  const isRedzone = yardline >= 80

  return {
    game,
    lastPlay,
    yardline,
    isRedzone,
    hasPossession
  }
}
