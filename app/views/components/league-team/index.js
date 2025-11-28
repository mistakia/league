import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { current_season, player_tag_types } from '@constants'
import {
  get_team_by_id_for_current_year,
  get_current_league,
  getRosterByTeamId,
  getGroupedPlayersByTeamId,
  is_restricted_free_agency_period,
  is_before_extension_deadline,
  get_cutlist_players,
  get_app,
  get_poach_players_for_current_league,
  get_teams_for_current_league,
  get_restricted_free_agency_players
} from '@core/selectors'
import { calculatePercentiles, getExtensionAmount } from '@libs-shared'
import { player_actions } from '@core/players'

import LeagueTeam from './league-team'

const map_state_to_props = createSelector(
  get_current_league,
  getRosterByTeamId,
  get_team_by_id_for_current_year,
  getGroupedPlayersByTeamId,
  is_restricted_free_agency_period,
  is_before_extension_deadline,
  get_cutlist_players,
  get_app,
  get_poach_players_for_current_league,
  get_teams_for_current_league,
  get_restricted_free_agency_players,
  (
    league,
    roster,
    team,
    players,
    is_restricted_free_agency_period,
    is_before_extension_deadline,
    cutlist,
    app,
    poaches,
    teams,
    restricted_free_agency_players
  ) => {
    const projectionType = current_season.isRegularSeason ? 'ros' : '0'
    const items = []
    players.players.forEach((p) => {
      const value = p.get('value', 0)
      const tag = p.get('tag')
      const isRestrictedFreeAgent =
        tag === player_tag_types.RESTRICTED_FREE_AGENCY
      const bid = p.get('bid', 0)
      const extensions = p.get('extensions', 0)
      const pos = p.get('pos')
      const slot = p.get('slot')
      const market_salary = p.getIn(['market_salary', '0'], 0)
      const extendedSalary = getExtensionAmount({
        pos,
        slot,
        tag: is_before_extension_deadline ? tag : player_tag_types.REGULAR,
        extensions,
        league,
        value,
        bid
      })
      const savings =
        !is_restricted_free_agency_period || bid || !isRestrictedFreeAgent
          ? market_salary -
            (is_before_extension_deadline ? extendedSalary : bid || value)
          : null

      let rookie_tag_savings = null
      let franchise_tag_savings = null

      if (is_before_extension_deadline) {
        const regular_extended_salary = getExtensionAmount({
          pos,
          slot,
          tag: player_tag_types.REGULAR,
          extensions,
          league,
          value
        })

        const is_rookie = p.get('nfl_draft_year') >= current_season.year - 1
        if (is_rookie) {
          rookie_tag_savings =
            Math.max(regular_extended_salary - value, 0) || null
        }

        franchise_tag_savings =
          Math.max(
            regular_extended_salary - (league[`f${pos?.toLowerCase()}`] || 0),
            0
          ) || null
      }

      items.push({
        salary: value,
        savings,
        market_salary,
        rookie_tag_savings,
        franchise_tag_savings,
        market_salary_adj: p.get('market_salary_adj', 0),
        projected_salary: p.getIn(['market_salary', projectionType], 0),
        pts_added: p.getIn(['pts_added', projectionType], 0),
        projected_starts: p.getIn(['lineups', 'starts'], 0),
        salary_adj_pts_added: p.getIn(
          ['salary_adj_pts_added', projectionType],
          0
        ),
        extendedSalary,
        points_added: p.get('points_added', 0),
        points_added_rnk: p.get('points_added_rnk'),
        points_added_pos_rnk: p.get('points_added_pos_rnk')
      })
    })

    const percentiles = calculatePercentiles({
      items,
      stats: [
        'salary',
        'savings',
        'market_salary',
        'rookie_tag_savings',
        'franchise_tag_savings',
        'market_salary_adj',
        'projected_salary',
        'pts_added',
        'projected_starts',
        'salary_adj_pts_added',
        'extended_salary',
        'points_added',
        'points_added_rnk',
        'points_added_pos_rnk'
      ]
    })

    return {
      league,
      roster,
      picks: team.picks,
      players,
      percentiles,
      cutlist,
      is_team_manager: app.teamId === team.uid,
      poaches,
      teams,
      restricted_free_agency_players
    }
  }
)

const map_dispatch_to_props = {
  load_team_players: player_actions.load_team_players
}

export default connect(map_state_to_props, map_dispatch_to_props)(LeagueTeam)
