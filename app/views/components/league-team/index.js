import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { current_season, player_tag_types } from '#constants'
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
import { calculatePercentiles, getExtensionAmount } from '#libs-shared'
import { player_actions } from '@core/players'

import LeagueTeam from './league-team'

// league.franchise_tag_salary_<pos> no longer shares a shape with the
// position code, so the per-position lookup needs an explicit map.
const franchise_tag_salary_field_by_position = {
  qb: 'franchise_tag_salary_quarterback',
  rb: 'franchise_tag_salary_running_back',
  wr: 'franchise_tag_salary_wide_receiver',
  te: 'franchise_tag_salary_tight_end'
}

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
    const projectionType = current_season.isRegularSeason
      ? 'rest_of_season'
      : 'season'
    const items = []
    players.players.forEach((p) => {
      const player_salary = p.get('player_salary', 0)
      const tag = p.get('tag')
      const isRestrictedFreeAgent =
        tag === player_tag_types.RESTRICTED_FREE_AGENCY
      // An ABSENT bid is "no bid" and must fall back to the prior salary; a $0 bid
      // is a real bid. Defaulting to 0 conflated the two and priced an unbid
      // restricted free agent at $0 through `getExtensionAmount`'s `??` branch.
      // Immutable's default only fires when the key is absent and reducers clear
      // this field to an explicit null, so coalesce rather than rely on it.
      const bid = p.get('bid_amount') ?? undefined
      const has_bid = bid !== undefined
      const extensions = p.get('extensions', 0)
      const pos = p.get('primary_position')
      const slot = p.get('slot')
      const market_salary = p.getIn(['market_salary', 'season'], 0)
      const extendedSalary = getExtensionAmount({
        pos,
        slot,
        tag: is_before_extension_deadline ? tag : player_tag_types.REGULAR,
        extensions,
        league,
        player_salary,
        bid
      })
      const savings =
        !is_restricted_free_agency_period || has_bid || !isRestrictedFreeAgent
          ? market_salary -
            (is_before_extension_deadline
              ? extendedSalary
              : (bid ?? player_salary))
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
          player_salary
        })

        const is_rookie = p.get('nfl_draft_year') >= current_season.year - 1
        if (is_rookie) {
          rookie_tag_savings =
            Math.max(regular_extended_salary - player_salary, 0) || null
        }

        franchise_tag_savings =
          Math.max(
            regular_extended_salary -
              (league[
                franchise_tag_salary_field_by_position[pos?.toLowerCase()]
              ] || 0),
            0
          ) || null
      }

      items.push({
        salary: player_salary,
        savings,
        market_salary,
        rookie_tag_savings,
        franchise_tag_savings,
        projected_positive_salary_at_available_cap: p.get(
          'projected_positive_salary_at_available_cap',
          0
        ),
        projected_salary: p.getIn(['market_salary', projectionType], 0),
        pts_added: p.getIn(['pts_added', projectionType], 0),
        pts_added_net: p.getIn(['pts_added', 'rest_of_season_net'], 0),
        projected_starts: p.getIn(['lineups', 'starts'], 0),
        projected_points_added_positive_including_cap_savings: p.getIn(
          [
            'projected_points_added_positive_including_cap_savings',
            projectionType
          ],
          0
        ),
        extendedSalary,
        points_added_earned: p.get('points_added_earned', 0),
        points_added_earned_rank: p.get('points_added_earned_rank'),
        points_added_earned_position_rank: p.get(
          'points_added_earned_position_rank'
        ),
        // Seasonlog fields for percentile calculation
        seasonlog_points: p.get('seasonlog_points', 0),
        points_per_game: p.get('points_per_game', 0),
        points_added_earned_per_game: p.get('points_added_earned_per_game', 0)
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
        'projected_positive_salary_at_available_cap',
        'projected_salary',
        'pts_added',
        'pts_added_net',
        'projected_starts',
        'projected_points_added_positive_including_cap_savings',
        'extended_salary',
        'points_added_earned',
        'points_added_earned_rank',
        'points_added_earned_position_rank',
        'seasonlog_points',
        'points_per_game',
        'points_added_earned_per_game'
      ]
    })

    return {
      league,
      roster,
      picks: team.picks,
      players,
      percentiles,
      cutlist,
      is_team_manager: app.teamId === team.team_id,
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
