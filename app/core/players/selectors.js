import { createSelector } from 'reselect'
import moment from 'moment'
import { constants, calculatePoints } from '@common'
import { getApp } from '@core/app'
import { getStats } from '@core/stats'
import { Player } from './player'
import { fuzzySearch } from '@core/utils'
import {
  getActiveRosterPlayerIdsForCurrentLeague,
  getRosteredPlayerIdsForCurrentLeague,
  getPracticeSquadPlayerIdsForCurrentLeague,
  getInjuredReservePlayerIdsForCurrentLeague
} from '@core/rosters'

export function getPlayers (state) {
  return state.get('players')
}

export function getSelectedPlayer (state) {
  const playerId = getPlayers(state).get('selected')
  const player = getPlayerById(state, { playerId })
  return player.toJS()
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
  const { qualifiers } = getStats(state)
  const players = state.get('players')
  const items = players.get('items')
  const search = players.get('search')
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

  const colleges = players.get('colleges')
  if (colleges.size !== constants.colleges.length) {
    filtered = filtered.filter(player => colleges.includes(player.college))
  }

  const collegeDivisions = players.get('collegeDivisions')
  if (collegeDivisions.size !== constants.collegeDivisions.length) {
    filtered = filtered.filter(player => collegeDivisions.includes(player.college_division))
  }

  const age = players.get('age')
  const allAges = players.get('allAges')
  if (age.size !== allAges.size) {
    const now = moment()
    filtered = filtered.filter(player => {
      const playerAge = parseInt(now.diff(moment(player.dob), 'years'), 10)
      return age.includes(playerAge)
    })
  }

  if (search) {
    filtered = filtered.filter(player => fuzzySearch(search, player.name))
  }

  const stat = players.get('orderBy').split('.').pop()
  const qualifier = qualifiers.get(stat)
  if (qualifier) {
    filtered = filtered.filter(player => player.getIn(['stats', qualifier.type]) >= qualifier.value)
  }

  const availability = players.get('availability')
  if (availability.size !== constants.availability.length) {
    const activeRosterPlayerIds = getActiveRosterPlayerIdsForCurrentLeague(state)
    const rosteredPlayerIds = getRosteredPlayerIdsForCurrentLeague(state)
    const practiceSquadPlayerIds = getPracticeSquadPlayerIdsForCurrentLeague(state)
    const injuredReservePlayerIds = getInjuredReservePlayerIdsForCurrentLeague(state)
    filtered = filtered.filter(player => {
      if (availability.includes('ROSTERED') && activeRosterPlayerIds.includes(player.player)) {
        return true
      }

      if (availability.includes('FREE AGENT') && !rosteredPlayerIds.includes(player.player)) {
        return true
      }

      if (availability.includes('PRACTICE SQUAD') && practiceSquadPlayerIds.includes(player.player)) {
        return true
      }

      if (availability.includes('INJURED RESERVE') && injuredReservePlayerIds.includes(player.player)) {
        return true
      }

      return false
    })
  }

  const sorted = filtered.sort(getComparator(players.get('order'), players.get('orderBy')))
  return sorted.toList()
}

export function getPlayersByPosition (state, { position }) {
  const players = state.get('players')
  const items = players.get('items')
  const filtered = items.filter(p => p.pos1 === position)
  return filtered.sort((a, b) => b.getIn(['points', 'total']) - a.getIn(['points', 'total'])).toList()
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

export function getGamesByYearForSelectedPlayer (state) {
  const playerId = state.get('players').get('selected')
  const p = getPlayerById(state, { playerId })
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
      stats.forEach(k => { sums[k] += (obj[k] || 0) })
      return sums
    }, initialValue)
    const points = calculatePoints({ stats: sum, position: p.pos1, ...league.toJS() })
    sum.total = points.total
    overall[year] = sum
  }

  return { years, overall }
}

export const getPlayersForWatchlist = createSelector(
  getPlayers,
  (players) => {
    return players.get('watchlist').toList().map(playerId => players.get('items').get(playerId) || new Player())
  }
)
