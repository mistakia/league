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
  const starterMaps = getStartersByTeamId(state, { tid, week })
  starterMaps.forEach((playerMap) => {
    const gamelog = getGamelogForPlayer(state, { playerMap, week })
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

  const starterMaps = getStartersByTeamId(state, { tid, week })
  const projected = starterMaps.reduce((sum, playerMap) => {
    const gamelog = getGamelogForPlayer(state, { playerMap, week })
    if (gamelog) {
      points += gamelog.total
      const gameStatus = getGameStatusByPlayerId(state, {
        pid: playerMap.get('pid'),
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
      : playerMap.getIn(['points', `${week}`, 'total'], 0)
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
  const playerMaps = Object.values(teams).flat()

  const games = {}
  for (const playerMap of playerMaps) {
    if (!playerMap.get('pid')) continue
    const game = getGameByTeam(state, {
      team: playerMap.get('team'),
      week: matchup.week
    })
    if (!game) continue
    const dateStr = `${game.date} ${game.time_est}`
    if (!games[dateStr]) games[dateStr] = []
    games[dateStr].push(playerMap)
  }

  return { matchup, games, teams }
}

export function getScoreboardGamelogByPlayerId(state, { pid }) {
  const playerMap = getPlayerById(state, { pid })

  if (!playerMap.get('pid')) return

  const week = state.getIn(['scoreboard', 'week'])
  return getGamelogForPlayer(state, { playerMap, week })
}

export function getPlaysByMatchupId(state, { mid }) {
  const matchup = getSelectedMatchup(state)
  if (!matchup) return new List()

  const playerMaps = matchup.tids.reduce((arr, tid) => {
    const starters = getStartersByTeamId(state, { tid, week: matchup.week })
    return arr.concat(starters)
  }, [])
  const gsisids = playerMaps.map((pMap) => pMap.get('gsisid')).filter(Boolean)
  if (!gsisids.length) return new List()

  const gsispids = playerMaps.map((pMap) => pMap.get('gsispid')).filter(Boolean)

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
      const playerMap = playerMaps.find((pMap) => {
        if (pMap.get('gsispid', false) === playStat.gsispid) return true
        if (pMap.get('gsisid', false) === playStat.gsisId) return true
        return false
      })
      if (!playerMap) continue
      const pid = playerMap.get('pid')
      if (!grouped[pid]) grouped[pid] = []
      grouped[pid].push(playStat)
    }
    const points = {}
    const stats = {}
    for (const pid in grouped) {
      const playerMap = playerMaps.find((pMap) => pMap.get('pid') === pid)
      const playStats = grouped[pid]
      stats[pid] = calculateStatsFromPlayStats(playStats)
      points[pid] = calculatePoints({
        stats: stats[pid],
        position: playerMap.get('pos'),
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
  { pid, week = constants.season.week }
) {
  const game = getGameByPlayerId(state, { pid, week })
  if (!game) {
    return null
  }

  const plays = getPlays(state, { week })
  const playerMap = getPlayerById(state, { pid })
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

  const hasPossession = fixTeam(lastPlay.pos_team) === playerMap.get('team')
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
