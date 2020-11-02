import { createSelector } from 'reselect'
import moment from 'moment-timezone'
import { constants, calculatePoints, isOnReleaseWaivers } from '@common'
import { getApp } from '@core/app'
import { getStats } from '@core/stats'
import { Player } from './player'
import { fuzzySearch } from '@core/utils'
import { isAfterDraft } from '@core/draft'
import { isAfterAuction } from '@core/auction'
import { getPoachesForCurrentLeague } from '@core/poaches'
import { getReleaseTransactions } from '@core/transactions'
import {
  getCurrentTeamRoster,
  getCurrentTeamRosterRecord,
  getActiveRosterPlayerIdsForCurrentLeague,
  getRosteredPlayerIdsForCurrentLeague,
  getPracticeSquadPlayerIdsForCurrentLeague,
  getInjuredReservePlayerIdsForCurrentLeague,
  isPlayerFreeAgent,
  isPlayerOnPracticeSquad,
  getRosterInfoForPlayerId
} from '@core/rosters'
import { getGameByTeam } from '@core/schedule'
import { getGamelogs } from '@core/gamelogs'

export function getPlayers (state) {
  return state.get('players')
}

export function getSelectedPlayer (state) {
  const playerId = getPlayers(state).get('selected')
  return getPlayerById(state, { playerId })
}

export function getSelectedPlayerGame (state) {
  const player = getSelectedPlayer(state)
  return getGameByTeam(state, { team: player.team })
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

      const exp = constants.season.year - player.draft_year
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
      if (availability.includes('ACTIVE ROSTER') && activeRosterPlayerIds.includes(player.player)) {
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

  const status = players.get('status')
  if (status.size !== Object.keys(constants.status).length) {
    filtered = filtered.filter(player => status.includes(player.status))
  }

  const teamIds = players.get('teamIds')
  if (teamIds.size) {
    filtered = filtered.filter(player => teamIds.includes(player.tid))
  }

  const sorted = filtered.sort(getComparator(players.get('order'), players.get('orderBy')))
  return sorted.toList()
}

// used by editable baseline component
export function getPlayersByPosition (state, { position }) {
  const players = state.get('players')
  const items = players.get('items')
  const filtered = items.filter(p => p.pos1 === position)
  const period = !constants.season.week ? '0' : 'ros'
  return filtered.sort((a, b) => b.getIn(['points', period, 'total']) - a.getIn(['points', period, 'total'])).toList()
}

export function getRookiePlayers (state) {
  const players = state.get('players')
  const items = players.get('items')
  return items.filter(p => p.draft_year === constants.season.year).toList()
}

export function getPlayerById (state, { playerId }) {
  const items = getAllPlayers(state)
  return items.get(playerId) || new Player()
}

export function getGamesByYearForSelectedPlayer (state) {
  const playerId = state.get('players').get('selected')
  const p = getPlayerById(state, { playerId })
  const gamelogs = getGamelogs(state)
  const games = gamelogs.filter(p => p.player === playerId)

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
    for (const stat of constants.fantasyStats) {
      initialValue[stat] = 0
    }

    const sum = years[year].reduce((sums, obj) => {
      const stats = Object.keys(obj).filter(k => constants.stats.includes(k))
      stats.forEach(k => { sums[k] += (obj[k] || 0) })
      return sums
    }, initialValue)
    const points = calculatePoints({ stats: sum, position: p.pos1, league: league.toJS() })
    sum.total = points.total
    overall[year] = sum
  }

  return { years, overall }
}

export function isPlayerOnReleaseWaivers (state, { player }) {
  const transactions = getReleaseTransactions(state)
  const playerTransactions = transactions.filter(t => t.player === player.player)

  return isOnReleaseWaivers({ transactions: playerTransactions.toJS() })
}

export function isPlayerReserveEligible (state, { player }) {
  const reserve = {
    ir: false,
    cov: false
  }

  if (player.status && player.status !== 'Active') {
    reserve.ir = true
  }

  if (player.status === 'Reserve/COVID-19') {
    reserve.cov = true
  }

  return reserve
}

export function isPlayerLocked (state, { player, playerId }) {
  if (playerId) {
    player = getPlayerById(state, { playerId })
  }

  if (!player) {
    return false
  }

  const game = getGameByTeam(state, { team: player.team })
  if (!game) {
    return false
  }

  const gameStart = moment.tz(game.date, 'M/D/YYYY H:m', 'America/New_York')
  if (moment().isAfter(gameStart)) {
    return true
  }

  return false
}

export function getPlayerStatus (state, { player, playerId }) {
  if (playerId) {
    player = getPlayerById(state, { playerId })
  }

  const status = {
    locked: false, // TODO
    starter: false,
    fa: false,
    rostered: false,
    waiver: {
      active: false,
      practice: false,
      poach: false
    },
    sign: {
      active: false,
      practice: false
    },
    eligible: {
      activate: false,
      ps: false,
      poach: false
    },
    reserve: {
      ir: false,
      covid: false
    }
  }

  if (!player || !player.player) {
    return status
  }

  status.starter = constants.starterSlots.includes(player.slot)
  status.locked = isPlayerLocked(state, { player })

  const isFreeAgent = isPlayerFreeAgent(state, { player })
  status.fa = isFreeAgent
  if (isFreeAgent) {
    if (constants.season.isRegularSeason && constants.season.isWaiverPeriod) {
      status.waiver.active = true
      const isPracticeSquadEligible = isPlayerPracticeSquadEligible(state, { player })
      if (isPracticeSquadEligible) status.waiver.practice = true
    } else {
      const onReleaseWaivers = isPlayerOnReleaseWaivers(state, { player })
      const afterAuction = isAfterAuction(state)
      const draft = isAfterDraft(state)
      const isPracticeSquadEligible = isPlayerPracticeSquadEligible(state, { player })
      if (onReleaseWaivers) {
        if (afterAuction) status.waiver.active = true
        if (draft.afterDraft && isPracticeSquadEligible) status.waiver.practice = true
      } else {
        if (afterAuction && !status.locked) {
          if (constants.season.isRegularSeason) status.sign.active = true
          else status.waiver.active = true
        }
        if (isPracticeSquadEligible && !status.locked) {
          if (draft.afterWaivers) status.sign.practice = true
          else if (draft.afterDraft) status.waiver.practice = true
        }
      }
    }
  } else {
    const roster = getCurrentTeamRoster(state)
    if (roster.has(player.player)) {
      status.rostered = true

      const isActive = !!roster.active.find(p => p.player === player.player)
      if (!isActive && roster.hasOpenBenchSlot(player.pos1)) {
        status.eligible.activate = true
      }

      if (isPlayerPracticeSquadEligible(state, { player }) &&
        roster.hasOpenPracticeSquadSlot()) {
        status.eligible.ps = true
      }

      const reserve = isPlayerReserveEligible(state, { player })
      if (reserve.ir && roster.hasOpenInjuredReserveSlot() &&
        player.slot !== constants.slots.IR) {
        status.reserve.ir = true
      }

      if (reserve.cov && player.slot !== constants.slots.COV) {
        status.reserve.cov = true
      }
    } else if (isPlayerOnPracticeSquad(state, { player })) {
      // check if player has existing poaching claim
      const leaguePoaches = getPoachesForCurrentLeague(state)
      if (!leaguePoaches.has(player.player)) {
        status.eligible.poach = true
      }

      const rosterInfo = getRosterInfoForPlayerId(state, { playerId: player.player })
      const cutoff = moment(rosterInfo.timestamp, 'X').add('24', 'hours')

      if ((rosterInfo.type === constants.transactions.ROSTER_DEACTIVATE ||
        rosterInfo.type === constants.transactions.DRAFT ||
        rosterInfo.type === constants.transactions.PRACTICE_ADD
      ) && moment().isBefore(cutoff)) {
        status.waiver.poach = true
      }
    }
  }

  return status
}

export function isPlayerPracticeSquadEligible (state, { player }) {
  if (!player || !player.player) {
    return false
  }

  // is a rookie
  if (player.draft_year !== constants.season.year) {
    return false
  }

  const rosterInfo = getRosterInfoForPlayerId(state, { playerId: player.player })
  const { teamId } = getApp(state)

  // not eligible if already on another team
  if (rosterInfo.tid && rosterInfo.tid !== teamId) {
    return false
  }

  // not eligible if already on pracice squad
  const onPracticeSquad = isPlayerOnPracticeSquad(state, { player })
  if (onPracticeSquad) {
    return false
  }

  const rosterRec = getCurrentTeamRosterRecord(state)
  const rosterPlayers = rosterRec.get('players')
  const rosterPlayer = rosterPlayers.find(p => p.player === player.player)

  if (!rosterPlayer) {
    return true
  }

  // not eligible if player has been on active roster for more than 48 hours
  const cutoff = moment(rosterPlayer.timestamp, 'X').add('48', 'hours')
  if (moment().isAfter(cutoff)) {
    return false
  }

  // TODO - check transaction history for deactivation or practice_add
  // not eligible if activated previously
  if (rosterPlayer.type === constants.transactions.ROSTER_ACTIVATE) {
    return false
  }

  // TODO - check entire transaction history for a poach
  // not eligible if player has been poached
  if (rosterPlayer.type === constants.transactions.POACHED) {
    return false
  }

  return true
}

export const getPlayersForWatchlist = createSelector(
  getPlayers,
  (players) => {
    return players.get('watchlist').toList().map(playerId => players.get('items').get(playerId) || new Player())
  }
)
