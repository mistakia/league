import { actions_utils } from '@core/utils'
const { create_api_actions, create_api_action_types } = actions_utils

export const team_actions = {
  ...create_api_action_types('GET_TEAMS'),
  ...create_api_action_types('PUT_TEAM'),
  ...create_api_action_types('POST_TEAMS'),
  ...create_api_action_types('DELETE_TEAMS'),
  ...create_api_action_types('GET_LEAGUE_TEAM_STATS'),

  LOAD_TEAMS: 'LOAD_TEAMS',
  load_teams: (leagueId) => ({
    type: team_actions.LOAD_TEAMS,
    payload: {
      leagueId: Number(leagueId)
    }
  }),

  LOAD_LEAGUE_TEAM_STATS: 'LOAD_LEAGUE_TEAM_STATS',
  load_league_team_stats: (leagueId) => ({
    type: team_actions.LOAD_LEAGUE_TEAM_STATS,
    payload: {
      leagueId: Number(leagueId)
    }
  }),

  ADD_TEAM: 'ADD_TEAM',
  add: () => ({
    type: team_actions.ADD_TEAM
  }),
  DELETE_TEAM: 'DELETE_TEAM',
  delete: (teamId) => ({
    type: team_actions.DELETE_TEAM,
    payload: {
      teamId
    }
  }),
  UPDATE_TEAM: 'UPDATE_TEAM',
  update: ({ teamId, field, value }) => ({
    type: team_actions.UPDATE_TEAM,
    payload: {
      teamId,
      field,
      value
    }
  })
}

export const get_teams_actions = create_api_actions('GET_TEAMS')
export const put_team_actions = create_api_actions('PUT_TEAM')
export const post_teams_actions = create_api_actions('POST_TEAMS')
export const delete_teams_actions = create_api_actions('DELETE_TEAMS')
export const get_league_team_stats_actions = create_api_actions(
  'GET_LEAGUE_TEAM_STATS'
)
