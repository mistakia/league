import { constants, calculatePoints } from '@common'
import { getApp } from '@core/app'
import { getLeagueById } from '@core/leagues'
import { Player } from './player'

export function getPlayers (state) {
  return state.get('players')
}

export function getAllPlayers (state) {
  return state.get('players').get('items')
}

function descendingComparator (a, b, orderBy) {
  const keyPath = orderBy.split('.')
  const aValue = a.getIn(keyPath)
  const bValue = b.getIn(keyPath)
  if (bValue < aValue) {
    return -1
  }
  if (bValue > aValue) {
    return 1
  }
  return 0
}

function getComparator (order, orderBy) {
  return order === 'desc'
    ? (a, b) => descendingComparator(a, b, orderBy)
    : (a, b) => -descendingComparator(a, b, orderBy)
}

export function getFilteredPlayers (state) {
  const players = state.get('players')
  const items = players.get('items')
  let filtered = items

  const positions = players.get('positions')
  if (positions.size !== constants.positions.length) {
    filtered = items.filter(player => positions.includes(player.pos1))
  }

  const experience = players.get('experience')
  if (experience.size < 3) {
    const veterans = experience.includes(-1)
    filtered = filtered.filter(player => {
      // exclude defenses
      if (!player.draft_year) {
        return false
      }

      const exp = constants.year - player.draft_year
      if (veterans && exp > 1) {
        return true
      }

      return experience.includes(exp)
    })
  }

  const nflTeams = players.get('nflTeams')
  if (nflTeams.size !== constants.nflTeams.length) {
    filtered = filtered.filter(player => nflTeams.includes(player.team))
  }

  const sorted = filtered.sort(getComparator(players.get('order'), players.get('orderBy')))

  return sorted.toList()
}

export function getRookiePlayers (state) {
  const players = state.get('players')
  const items = players.get('items')
  return items.filter(p => p.draft_year === constants.year).toList()
}

export function getPlayerById (state, { playerId }) {
  const items = getAllPlayers(state)
  return items.get(playerId) || new Player()
}

export function getGamesByYearForPlayer (state, { player }) {
  const p = getPlayerById(state, { playerId: player.player })
  const games = p.get('games')

  const years = {}
  for (const game of games) {
    if (!years[game.year]) years[game.year] = []
    years[game.year].push(game)
  }

  // sum yearly values
  const { leagueId } = getApp(state)
  const league = state.get('leagues').get(leagueId)
  const overall = {}
  for (const year in years) {
    const initialValue = {}
    for (const stat of constants.stats) {
      initialValue[stat] = 0
    }

    const sum = years[year].reduce((sums, obj) => {
      const stats = Object.keys(obj).filter(k => constants.stats.includes(k))
      stats.forEach(k => sums[k] += (obj[k] || 0) )
      return sums
    }, initialValue)
    const points = calculatePoints({ stats: sum, ...league.toJS() })
    sum.total = points.total
    overall[year] = sum
  }

  return { years, overall }
}
