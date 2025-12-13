import { createSelector } from 'reselect'

import { get_player_fields } from '@core/player-fields'
import {
  current_season,
  fantasy_positions,
  player_nfl_status,
  player_tag_types,
  practice_squad_slots,
  nfl_draft_rounds,
  nfl_team_abbreviations,
  ncaa_college_names,
  ncaa_conference_names,
  player_availability_statuses
} from '@constants'
import {
  get_stats_state,
  get_active_roster_player_ids_for_current_league,
  get_injured_reserve_player_ids_for_current_league,
  get_practice_squad_player_ids_for_current_league,
  get_practice_squad_unprotected_player_ids_for_current_league,
  get_practice_squad_protected_player_ids_for_current_league,
  get_rostered_player_ids_for_current_league,
  get_selected_players_page_view
} from '@core/selectors'
import { fuzzy_search } from '@core/utils'

function descendingComparator(a, b, key_path = [], get_player_field_value) {
  const aValue = get_player_field_value
    ? get_player_field_value(a)
    : a.getIn(key_path)
  const bValue = get_player_field_value
    ? get_player_field_value(b)
    : b.getIn(key_path)
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
  const { qualifiers } = get_stats_state(state)
  const pState = state.get('players')
  let filtered = pState.get('items')
  const search = pState.get('search')

  const watchlist = pState.get('watchlist')
  if (pState.get('watchlistOnly')) {
    filtered = filtered.filter((player_map) =>
      watchlist.includes(player_map.get('pid'))
    )
  }

  const positions = pState.get('positions')
  if (positions.size !== fantasy_positions.length) {
    filtered = filtered.filter((player_map) =>
      positions.includes(player_map.get('pos'))
    )
  }

  const nfl_draft_rounds_filter = pState.get('nfl_draft_rounds')
  if (nfl_draft_rounds_filter.size !== nfl_draft_rounds.length) {
    filtered = filtered.filter((player_map) =>
      nfl_draft_rounds_filter.includes(player_map.get('round'))
    )
  }

  const experience = pState.get('experience')
  if (experience.size < 3) {
    const veterans = experience.includes(-1)
    filtered = filtered.filter((player_map) => {
      // exclude defenses
      const draft_year = player_map.get('nfl_draft_year')
      if (!draft_year) {
        return false
      }

      const exp = current_season.year - draft_year
      if (veterans && exp > 1) {
        return true
      }

      return experience.includes(exp)
    })
  }

  const nflTeams = pState.get('nflTeams')
  if (nflTeams.size !== nfl_team_abbreviations.length) {
    filtered = filtered.filter((player_map) =>
      nflTeams.includes(player_map.get('team'))
    )
  }

  const colleges = pState.get('colleges')
  if (colleges.size !== ncaa_college_names.length) {
    filtered = filtered.filter((player_map) =>
      colleges.includes(player_map.get('col'))
    )
  }

  const collegeDivisions = pState.get('collegeDivisions')
  if (collegeDivisions.size !== ncaa_conference_names.length) {
    filtered = filtered.filter((player_map) =>
      collegeDivisions.includes(player_map.get('dv'))
    )
  }

  if (search) {
    filtered = filtered.filter((player_map) =>
      fuzzy_search(search, player_map.get('name'))
    )
  }

  const stat = pState.get('orderBy').split('.').pop()
  const qualifier = qualifiers.get(stat)
  if (qualifier) {
    filtered = filtered.filter(
      (player_map) =>
        player_map.getIn(['stats', qualifier.type]) >= qualifier.value
    )
  }

  const availability = pState.get('availability')
  if (availability.size !== player_availability_statuses.length) {
    const activeRosterPlayerIds =
      get_active_roster_player_ids_for_current_league(state)
    const rosteredPlayerIds = get_rostered_player_ids_for_current_league(state)
    const practiceSquadPlayerIds =
      get_practice_squad_player_ids_for_current_league(state)
    const practiceSquadUnprotectedPlayerIds =
      get_practice_squad_unprotected_player_ids_for_current_league(state)
    const practiceSquadProtectedPlayerIds =
      get_practice_squad_protected_player_ids_for_current_league(state)
    const injuredReservePlayerIds =
      get_injured_reserve_player_ids_for_current_league(state)
    filtered = filtered.filter((player_map) => {
      if (
        availability.includes('ACTIVE ROSTER') &&
        activeRosterPlayerIds.includes(player_map.get('pid'))
      ) {
        return true
      }

      if (
        availability.includes('FREE AGENT') &&
        !rosteredPlayerIds.includes(player_map.get('pid'))
      ) {
        return true
      }

      if (
        availability.includes('PRACTICE SQUAD') &&
        practiceSquadPlayerIds.includes(player_map.get('pid'))
      ) {
        return true
      }

      if (
        availability.includes('PRACTICE SQUAD UNPROTECTED') &&
        practiceSquadUnprotectedPlayerIds.includes(player_map.get('pid'))
      ) {
        return true
      }

      if (
        availability.includes('PRACTICE SQUAD PROTECTED') &&
        practiceSquadProtectedPlayerIds.includes(player_map.get('pid'))
      ) {
        return true
      }

      if (
        availability.includes('INJURED RESERVE') &&
        injuredReservePlayerIds.includes(player_map.get('pid'))
      ) {
        return true
      }

      if (
        availability.includes('RESTRICTED FREE AGENT') &&
        player_map.get('tag') === player_tag_types.RESTRICTED_FREE_AGENCY
      ) {
        return true
      }

      if (
        availability.includes('POTENTIAL FREE AGENT') &&
        player_map.get('tid')
      ) {
        const salary = player_map.get('value')
        const market_salary_adj = player_map.get('market_salary_adj', 0)
        const tag = player_map.get('tag')
        const slot = player_map.get('slot')
        const isRestrictedOrFranchised =
          tag === player_tag_types.RESTRICTED_FREE_AGENCY ||
          tag === player_tag_types.FRANCHISE
        if (
          !practice_squad_slots.includes(slot) &&
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
    selected_player_nfl_statuses.size !== Object.keys(player_nfl_status).length
  ) {
    filtered = filtered.filter((player_map) =>
      selected_player_nfl_statuses.includes(player_map.get('roster_status'))
    )
  }

  const teamIds = pState.get('teamIds')
  if (teamIds.size) {
    filtered = filtered.filter((player_map) =>
      teamIds.includes(player_map.get('tid'))
    )
  }

  const player_view_fields = get_player_fields(state)
  const order_by = pState.get('orderBy')
  const order_by_key_path = player_view_fields[order_by].key_path
  const order_by_value_func =
    player_view_fields[order_by].get_player_field_value
  const sorted = filtered.sort(
    getComparator(pState.get('order'), order_by_key_path, order_by_value_func)
  )
  return sorted.toList()
}

export const getSelectedViewGroupedFields = createSelector(
  get_selected_players_page_view,
  get_player_fields,
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
