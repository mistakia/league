import { createSelector } from 'reselect'

import { getPlayerFields } from '@core/player-fields'
import { constants } from '@libs-shared'
import {
  getStats,
  getActiveRosterPlayerIdsForCurrentLeague,
  getInjuredReservePlayerIdsForCurrentLeague,
  getPracticeSquadPlayerIdsForCurrentLeague,
  getPracticeSquadUnprotectedPlayerIdsForCurrentLeague,
  getPracticeSquadProtectedPlayerIdsForCurrentLeague,
  getRosteredPlayerIdsForCurrentLeague,
  getSelectedPlayersPageView
} from '@core/selectors'
import { fuzzySearch } from '@core/utils'

function descendingComparator(a, b, key_path = [], getValue) {
  const aValue = getValue ? getValue(a) : a.getIn(key_path)
  const bValue = getValue ? getValue(b) : b.getIn(key_path)
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

function getComparator(order, key_path, get_value_func) {
  return order === 'desc'
    ? (a, b) => descendingComparator(a, b, key_path, get_value_func)
    : (a, b) => -descendingComparator(a, b, key_path, get_value_func)
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

  const nfl_draft_rounds = pState.get('nfl_draft_rounds')
  if (nfl_draft_rounds.size !== constants.nfl_draft_rounds.length) {
    filtered = filtered.filter((playerMap) =>
      nfl_draft_rounds.includes(playerMap.get('round'))
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

      const exp = constants.year - draft_year
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
    const practiceSquadUnprotectedPlayerIds =
      getPracticeSquadUnprotectedPlayerIdsForCurrentLeague(state)
    const practiceSquadProtectedPlayerIds =
      getPracticeSquadProtectedPlayerIdsForCurrentLeague(state)
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
        availability.includes('PRACTICE SQUAD UNPROTECTED') &&
        practiceSquadUnprotectedPlayerIds.includes(playerMap.get('pid'))
      ) {
        return true
      }

      if (
        availability.includes('PRACTICE SQUAD PROTECTED') &&
        practiceSquadProtectedPlayerIds.includes(playerMap.get('pid'))
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
        const market_salary_adj = playerMap.get('market_salary_adj', 0)
        const tag = playerMap.get('tag')
        const slot = playerMap.get('slot')
        const isRestrictedOrFranchised =
          tag === constants.tags.TRANSITION || tag === constants.tags.FRANCHISE
        if (
          !constants.ps_slots.includes(slot) &&
          !isRestrictedOrFranchised &&
          salary - market_salary_adj * 0.85 > 0
        ) {
          return true
        }
      }

      return false
    })
  }

  const selected_player_nfl_statuses = pState.get('selected_nfl_statuses')
  if (
    selected_player_nfl_statuses.size !==
    Object.keys(constants.player_nfl_status).length
  ) {
    filtered = filtered.filter((playerMap) =>
      selected_player_nfl_statuses.includes(playerMap.get('nfl_status'))
    )
  }

  const teamIds = pState.get('teamIds')
  if (teamIds.size) {
    filtered = filtered.filter((playerMap) =>
      teamIds.includes(playerMap.get('tid'))
    )
  }

  const player_view_fields = getPlayerFields(state)
  const order_by = pState.get('orderBy')
  const order_by_key_path = player_view_fields[order_by].key_path
  const order_by_value_func = player_view_fields[order_by].getValue
  const sorted = filtered.sort(
    getComparator(pState.get('order'), order_by_key_path, order_by_value_func)
  )
  return sorted.toList()
}

export const getSelectedViewGroupedFields = createSelector(
  getSelectedPlayersPageView,
  getPlayerFields,
  (selected_players_page_view, fields) => {
    return selected_players_page_view.fields.reduce((groups, field) => {
      const field_info = fields[field]
      const lastGroup = groups[groups.length - 1]
      if (!lastGroup || lastGroup.category !== field_info.category) {
        groups.push({
          category: field_info.category,
          fields: [field_info]
        })
      } else {
        lastGroup.fields.push(field_info)
      }
      return groups
    }, [])
  }
)
