import { createSelector } from 'reselect'
import dayjs from 'dayjs'
import { Map } from 'immutable'

import {
  constants,
  calculatePoints,
  isOnReleaseWaivers,
  getExtensionAmount,
  isReserveEligible,
  isReserveCovEligible,
  isSantuaryPeriod,
  isSlotActive
} from '@common'
import { getApp } from '@core/app'
import { getStats } from '@core/stats'
import { fuzzySearch } from '@core/utils'
import { isAfterDraft } from '@core/draft'
import { isAfterAuction } from '@core/auction'
import { getPoachesForCurrentLeague } from '@core/poaches'
import { getReleaseTransactions } from '@core/transactions'
import {
  getCurrentLeague,
  isBeforeExtensionDeadline,
  isBeforeTransitionStart
} from '@core/leagues'
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
import { getGameByTeam, getGamesByTeam } from '@core/schedule'
import { getPlayerGamelogs } from '@core/gamelogs'

export function getPlayers(state) {
  return state.get('players')
}

export function getBaselines(state) {
  const result = state.getIn(['players', 'baselines'])
  const playerMaps = getAllPlayers(state)
  return result.withMutations((b) => {
    for (const [week, positions] of b.entrySeq()) {
      if (constants.positions.includes(week)) continue
      for (const [position, baselines] of positions.entrySeq()) {
        for (const [baseline, pid] of baselines.entrySeq()) {
          b.setIn([week, position, baseline], playerMaps.get(pid))
        }
      }
    }
  })
}

export function getTransitionPlayers(state) {
  const playerMaps = getAllPlayers(state)
  return playerMaps.filter(
    (pMap) => pMap.get('tag') === constants.tags.TRANSITION
  )
}

export function getCutlistPlayers(state) {
  const cutlist = state.getIn(['players', 'cutlist'])
  return cutlist.map((pid) => getPlayerById(state, { pid }))
}

export function getCutlistTotalSalary(state) {
  const playerMaps = getCutlistPlayers(state)
  const league = getCurrentLeague(state)
  const isBeforeExtension = isBeforeExtensionDeadline(state)

  return playerMaps.reduce((sum, playerMap) => {
    const value = playerMap.get('value')
    const extensions = playerMap.get('extensions', 0)
    const bid = playerMap.get('bid', 0)
    const salary = isBeforeExtension
      ? getExtensionAmount({
          pos: playerMap.get('pos'),
          tag: playerMap.get('tag'),
          extensions,
          league,
          value,
          bid
        })
      : bid || value

    return sum + salary
  }, 0)
}

export function getSelectedPlayer(state) {
  const pid = getPlayers(state).get('selected')
  return getPlayerById(state, { pid })
}

export function getSelectedPlayerGame(state, { week }) {
  const playerMap = getSelectedPlayer(state)
  return getGameByTeam(state, { team: playerMap.get('team'), week })
}

export function getSelectedPlayerGames(state) {
  const playerMap = getSelectedPlayer(state)
  return getGamesByTeam(state, { team: playerMap.get('team') })
}

export function getAllPlayers(state) {
  return state.get('players').get('items')
}

function descendingComparator(a, b, orderBy) {
  const keyPath = orderBy.split('.')
  const aValue = a.getIn(keyPath)
  const bValue = b.getIn(keyPath)
  if (typeof bValue === 'undefined' || bValue === null) {
    return -1
  }

  if (typeof aValue === 'undefined' || aValue === null) {
    return 1
  }

  if (bValue < aValue) {
    return -1
  }
  if (bValue > aValue) {
    return 1
  }
  return 0
}

function getComparator(order, orderBy) {
  return order === 'desc'
    ? (a, b) => descendingComparator(a, b, orderBy)
    : (a, b) => -descendingComparator(a, b, orderBy)
}

export function getFilteredPlayers(state) {
  const { qualifiers } = getStats(state)
  const pState = state.get('players')
  let filtered = pState.get('items')
  const search = pState.get('search')

  const watchlist = pState.get('watchlist')
  if (pState.get('watchlistOnly')) {
    filtered = filtered.filter((playerMap) =>
      watchlist.includes(playerMap.get('pid'))
    )
  }

  const positions = pState.get('positions')
  if (positions.size !== constants.positions.length) {
    filtered = filtered.filter((playerMap) =>
      positions.includes(playerMap.get('pos'))
    )
  }

  const experience = pState.get('experience')
  if (experience.size < 3) {
    const veterans = experience.includes(-1)
    filtered = filtered.filter((playerMap) => {
      // exclude defenses
      const draft_year = playerMap.get('start')
      if (!draft_year) {
        return false
      }

      const exp = constants.season.year - draft_year
      if (veterans && exp > 1) {
        return true
      }

      return experience.includes(exp)
    })
  }

  const nflTeams = pState.get('nflTeams')
  if (nflTeams.size !== constants.nflTeams.length) {
    filtered = filtered.filter((playerMap) =>
      nflTeams.includes(playerMap.get('team'))
    )
  }

  const colleges = pState.get('colleges')
  if (colleges.size !== constants.colleges.length) {
    filtered = filtered.filter((playerMap) =>
      colleges.includes(playerMap.get('col'))
    )
  }

  const collegeDivisions = pState.get('collegeDivisions')
  if (collegeDivisions.size !== constants.collegeDivisions.length) {
    filtered = filtered.filter((playerMap) =>
      collegeDivisions.includes(playerMap.get('dv'))
    )
  }

  const age = pState.get('age')
  const allAges = pState.get('allAges')
  if (age.size !== allAges.size) {
    const now = dayjs()
    filtered = filtered.filter((playerMap) => {
      const playerAge = parseInt(
        now.diff(dayjs(playerMap.get('dob')), 'years'),
        10
      )
      return age.includes(playerAge)
    })
  }

  if (search) {
    filtered = filtered.filter((playerMap) =>
      fuzzySearch(search, playerMap.get('name'))
    )
  }

  const stat = pState.get('orderBy').split('.').pop()
  const qualifier = qualifiers.get(stat)
  if (qualifier) {
    filtered = filtered.filter(
      (playerMap) =>
        playerMap.getIn(['stats', qualifier.type]) >= qualifier.value
    )
  }

  const availability = pState.get('availability')
  if (availability.size !== constants.availability.length) {
    const activeRosterPlayerIds =
      getActiveRosterPlayerIdsForCurrentLeague(state)
    const rosteredPlayerIds = getRosteredPlayerIdsForCurrentLeague(state)
    const practiceSquadPlayerIds =
      getPracticeSquadPlayerIdsForCurrentLeague(state)
    const injuredReservePlayerIds =
      getInjuredReservePlayerIdsForCurrentLeague(state)
    filtered = filtered.filter((playerMap) => {
      if (
        availability.includes('ACTIVE ROSTER') &&
        activeRosterPlayerIds.includes(playerMap.get('pid'))
      ) {
        return true
      }

      if (
        availability.includes('FREE AGENT') &&
        !rosteredPlayerIds.includes(playerMap.get('pid'))
      ) {
        return true
      }

      if (
        availability.includes('PRACTICE SQUAD') &&
        practiceSquadPlayerIds.includes(playerMap.get('pid'))
      ) {
        return true
      }

      if (
        availability.includes('INJURED RESERVE') &&
        injuredReservePlayerIds.includes(playerMap.get('pid'))
      ) {
        return true
      }

      if (
        availability.includes('RESTRICTED FREE AGENT') &&
        playerMap.get('tag') === constants.tags.TRANSITION
      ) {
        return true
      }

      if (
        availability.includes('POTENTIAL FREE AGENT') &&
        playerMap.get('tid')
      ) {
        const salary = playerMap.get('value')
        const market_salary = playerMap.getIn(['market_salary', '0'], 0)
        if (salary - market_salary > 0) {
          return true
        }
      }

      return false
    })
  }

  const status = pState.get('status')
  if (status.size !== Object.keys(constants.status).length) {
    filtered = filtered.filter((playerMap) =>
      status.includes(playerMap.get('status'))
    )
  }

  const teamIds = pState.get('teamIds')
  if (teamIds.size) {
    filtered = filtered.filter((playerMap) =>
      teamIds.includes(playerMap.get('tid'))
    )
  }

  const sorted = filtered.sort(
    getComparator(pState.get('order'), pState.get('orderBy'))
  )
  return sorted.toList()
}

// used by editable baseline component
export function getPlayersByPosition(state, { position }) {
  const playerMaps = state.getIn(['players', 'items'])
  const filtered = playerMaps.filter((p) => p.pos === position)
  const period = !constants.season.week ? '0' : 'ros'
  return filtered
    .sort(
      (a, b) =>
        b.getIn(['points', period, 'total']) -
        a.getIn(['points', period, 'total'])
    )
    .toList()
}

export function getRookiePlayers(state) {
  const playerMaps = state.getIn(['players', 'items'])
  return playerMaps
    .filter((pMap) => pMap.get('start') === constants.season.year)
    .toList()
}

export function getPlayerById(state, { pid }) {
  const playerMaps = getAllPlayers(state)
  return playerMaps.get(pid) || new Map()
}

export function getGamesByYearForSelectedPlayer(state) {
  const pid = state.get('players').get('selected')
  const playerMap = getPlayerById(state, { pid })
  const gamelogs = getPlayerGamelogs(state)
  const games = gamelogs.filter((p) => p.pid === pid)

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
      const stats = Object.keys(obj).filter((k) => constants.stats.includes(k))
      stats.forEach((k) => {
        sums[k] += obj[k] || 0
      })
      return sums
    }, initialValue)
    const points = calculatePoints({
      stats: sum,
      position: playerMap.get('pos'),
      league: league.toJS()
    })
    sum.total = points.total
    overall[year] = sum
  }

  return { years, overall }
}

export function isPlayerOnReleaseWaivers(state, { pid }) {
  const transactions = getReleaseTransactions(state)
  const playerTransactions = transactions.filter((t) => t.pid === pid)

  return isOnReleaseWaivers({ transactions: playerTransactions.toJS() })
}

export function isPlayerReserveEligible(state, { playerMap }) {
  const reserve = {
    ir: false,
    cov: false
  }

  const params = {
    status: playerMap.get('status'),
    injury_status: playerMap.get('injury_status')
  }

  if (isReserveEligible(params)) {
    reserve.ir = true
  }

  if (isReserveCovEligible(params)) {
    reserve.cov = true
  }

  return reserve
}

export function isPlayerLocked(state, { playerMap = new Map(), pid }) {
  if (constants.season.week > constants.season.finalWeek) {
    return true
  }

  if (pid) {
    playerMap = getPlayerById(state, { pid })
  }

  if (!playerMap.get('pid')) {
    return false
  }

  if (playerMap.get('status') === 'Inactive') {
    return false
  }

  const game = getGameByTeam(state, { team: playerMap.get('team') })
  if (!game) {
    return false
  }

  const gameStart = dayjs.tz(
    `${game.date} ${game.time_est}`,
    'YYYY/MM/DD HH:mm:SS',
    'America/New_York'
  )
  if (dayjs().isAfter(gameStart)) {
    return true
  }

  return false
}

export function getPlayerStatus(state, { playerMap = new Map(), pid }) {
  if (pid) {
    playerMap = getPlayerById(state, { pid })
  }

  const status = {
    locked: false, // TODO
    starter: false,
    fa: false,
    rostered: false,
    protected: false,
    active: false,
    bid: null,
    release_penalty: 0,
    tagged: {
      rookie: false,
      transition: false,
      franchise: false
    },
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
      protect: false,
      activate: false,
      ps: false,
      poach: false,
      rookieTag: false,
      transitionTag: false,
      transitionBid: false
    },
    reserve: {
      ir: false,
      covid: false
    }
  }

  if (!playerMap.get('pid')) {
    return status
  }

  const playerTag = playerMap.get('tag')
  const playerSlot = playerMap.get('slot')
  const playerId = playerMap.get('pid')
  status.bid = playerMap.get('bid')
  status.tagged.rookie = playerTag === constants.tags.ROOKIE
  status.tagged.transition = playerTag === constants.tags.TRANSITION
  status.tagged.franchise = playerTag === constants.tags.FRANCHISE
  status.protected = playerSlot === constants.slots.PSP
  status.starter = constants.starterSlots.includes(playerSlot)
  status.locked = isPlayerLocked(state, { playerMap })
  status.active = isSlotActive(playerSlot)

  const isFreeAgent = isPlayerFreeAgent(state, { playerMap })
  status.fa = isFreeAgent
  if (isFreeAgent) {
    const { isWaiverPeriod, isRegularSeason } = constants.season
    if (isRegularSeason && isWaiverPeriod) {
      status.waiver.active = true
      const isPracticeSquadEligible = isPlayerPracticeSquadEligible(state, {
        playerMap
      })
      if (isPracticeSquadEligible) status.waiver.practice = true
    } else {
      const onReleaseWaivers = isPlayerOnReleaseWaivers(state, { pid })
      const afterAuction = isAfterAuction(state)
      const draft = isAfterDraft(state)
      const isPracticeSquadEligible = isPlayerPracticeSquadEligible(state, {
        playerMap
      })
      if (onReleaseWaivers) {
        if (afterAuction) status.waiver.active = true
        if (draft.afterDraft && isPracticeSquadEligible)
          status.waiver.practice = true
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
    const league = getCurrentLeague(state)
    const now = dayjs()

    if (status.tagged.transition && now.isBefore(dayjs.unix(league.tran_end))) {
      status.eligible.transitionBid = true
    }

    if (roster.has(playerId)) {
      status.rostered = true

      // if before extension deadline
      //     was player a rookie last year
      //     otherwise are they a rookie now
      const isBeforeExtension = isBeforeExtensionDeadline(state)
      const isBeforeRestrictedFreeAgency = isBeforeTransitionStart(state)
      const draft_year = playerMap.get('start')
      if (isBeforeExtension && draft_year === constants.season.year - 1) {
        status.eligible.rookieTag = true
      } else if (draft_year === constants.season.year) {
        status.eligible.rookieTag = true
      }

      if (constants.season.week > 0 || isBeforeExtension) {
        status.eligible.franchiseTag = true
      }

      status.eligible.transitionTag = isBeforeRestrictedFreeAgency

      const isActive = Boolean(
        roster.active.find(({ pid }) => pid === playerId)
      )
      if (!isActive) {
        status.eligible.activate = true

        // is regular season and is on practice squad && has no poaching claims
        const leaguePoaches = getPoachesForCurrentLeague(state)
        if (
          constants.season.isRegularSeason &&
          playerSlot === constants.slots.PS &&
          !leaguePoaches.has(playerId)
        ) {
          status.eligible.protect = true
        }
      } else {
        // is active player
        if (constants.season.isOffseason) {
          // TODO if offseason and player was poached this offseason

          // if offseason and player was acquired during RFA from another team
          const rosterRec = getCurrentTeamRosterRecord(state)
          if (rosterRec.acquired_rfa_pids.includes(playerId)) {
            status.release_penalty = playerMap.get('value')
          }
        }
      }

      if (
        isPlayerPracticeSquadEligible(state, { playerMap }) &&
        roster.hasOpenPracticeSquadSlot()
      ) {
        status.eligible.ps = true
      }

      if (
        !status.protected &&
        constants.season.week <= constants.season.finalWeek
      ) {
        const reserve = isPlayerReserveEligible(state, { playerMap })
        if (reserve.ir && playerSlot !== constants.slots.IR) {
          status.reserve.ir = true
        }

        if (
          reserve.cov &&
          playerSlot !== constants.slots.COV &&
          constants.season.isRegularSeason
        ) {
          status.reserve.cov = true
        }
      }
    } else if (isPlayerOnPracticeSquad(state, { playerMap })) {
      // make sure player is unprotected and it is not a santuary period
      if (playerSlot === constants.slots.PS && !isSantuaryPeriod(league)) {
        const rosterInfo = getRosterInfoForPlayerId(state, {
          pid: playerId
        })
        const sanctuaryEnd = dayjs.unix(rosterInfo.timestamp).add('24', 'hours')
        const cutoff = dayjs.unix(rosterInfo.timestamp).add('48', 'hours')

        // check if player has existing poaching claim and is after sanctuary period
        const leaguePoaches = getPoachesForCurrentLeague(state)
        if (!leaguePoaches.has(playerId) && dayjs().isAfter(sanctuaryEnd)) {
          status.eligible.poach = true
        }

        if (
          (rosterInfo.type === constants.transactions.ROSTER_DEACTIVATE ||
            rosterInfo.type === constants.transactions.DRAFT ||
            rosterInfo.type === constants.transactions.PRACTICE_ADD) &&
          dayjs().isBefore(cutoff)
        ) {
          status.waiver.poach = true
        }
      }
    }
  }

  return status
}

export function isPlayerPracticeSquadEligible(
  state,
  { playerMap = new Map() }
) {
  const pid = playerMap.get('pid')
  if (!pid) {
    return false
  }

  // is a rookie OR is not on a team OR is on a teams practice squad
  if (
    !constants.season.isRegularSeason &&
    playerMap.get('start') !== constants.season.year &&
    playerMap.get('posd') !== 'PS' &&
    playerMap.get('team') !== 'INA'
  ) {
    return false
  }

  const rosterInfo = getRosterInfoForPlayerId(state, { pid })
  const { teamId } = getApp(state)

  // not eligible if already on another team
  if (rosterInfo.tid && rosterInfo.tid !== teamId) {
    return false
  }

  // not eligible if already on pracice squad
  const onPracticeSquad = isPlayerOnPracticeSquad(state, { playerMap })
  if (onPracticeSquad) {
    return false
  }

  const rosterRec = getCurrentTeamRosterRecord(state)
  const rosterPlayers = rosterRec.get('players')
  const rosterPlayer = rosterPlayers.find((p) => p.pid === pid)

  if (!rosterPlayer) {
    return true
  }

  // not eligible if player has been on active roster for more than 48 hours
  const cutoff = dayjs.unix(rosterPlayer.timestamp).add('48', 'hours')
  if (isSlotActive(rosterPlayer.slot) && dayjs().isAfter(cutoff)) {
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

export const getPlayersForWatchlist = createSelector(getPlayers, (players) => {
  return players
    .get('watchlist')
    .toList()
    .map((pid) => players.get('items').get(pid) || new Map())
})
