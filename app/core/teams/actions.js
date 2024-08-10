import { actions_utils } from '@core/utils'
const { create_api_actions, create_api_action_types } = actions_utils

export const teamActions = {
  ...create_api_action_types('GET_TEAMS'),
  ...create_api_action_types('PUT_TEAM'),
  ...create_api_action_types('POST_TEAMS'),
  ...create_api_action_types('DELETE_TEAMS'),
  ...create_api_action_types('GET_LEAGUE_TEAM_STATS'),

  LOAD_TEAMS: 'LOAD_TEAMS',
  loadTeams: (leagueId) => ({
    type: teamActions.LOAD_TEAMS,
    payload: {
      leagueId: Number(leagueId)
    }
  }),

  LOAD_LEAGUE_TEAM_STATS: 'LOAD_LEAGUE_TEAM_STATS',
  loadLeagueTeamStats: (leagueId) => ({
    type: teamActions.LOAD_LEAGUE_TEAM_STATS,
    payload: {
      leagueId: Number(leagueId)
    }
  }),

  ADD_TEAM: 'ADD_TEAM',
  add: () => ({
    type: teamActions.ADD_TEAM
  }),
  DELETE_TEAM: 'DELETE_TEAM',
  delete: (teamId) => ({
    type: teamActions.DELETE_TEAM,
    payload: {
      teamId
    }
  }),
  UPDATE_TEAM: 'UPDATE_TEAM',
  update: ({ teamId, field, value }) => ({
    type: teamActions.UPDATE_TEAM,
    payload: {
      teamId,
      field,
      value
    }
  })
}

export const getTeamsActions = create_api_actions('GET_TEAMS')
export const putTeamActions = create_api_actions('PUT_TEAM')
export const postTeamsActions = create_api_actions('POST_TEAMS')
export const deleteTeamsActions = create_api_actions('DELETE_TEAMS')
export const getLeagueTeamStatsActions = create_api_actions(
  'GET_LEAGUE_TEAM_STATS'
)
