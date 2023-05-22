export const league_team_daily_values_actions = {
  LOAD_LEAGUE_TEAM_DAILY_VALUES: 'LOAD_LEAGUE_TEAM_DAILY_VALUES',

  GET_LEAGUE_TEAM_DAILY_VALUES_FAILED: 'GET_LEAGUE_TEAM_DAILY_VALUES_FAILED',
  GET_LEAGUE_TEAM_DAILY_VALUES_PENDING: 'GET_LEAGUE_TEAM_DAILY_VALUES_PENDING',
  GET_LEAGUE_TEAM_DAILY_VALUES_FULFILLED:
    'GET_LEAGUE_TEAM_DAILY_VALUES_FULFILLED',

  load_league_team_daily_values: () => ({
    type: league_team_daily_values_actions.LOAD_LEAGUE_TEAM_DAILY_VALUES
  }),

  get_league_team_daily_values_failed: (opts, error) => ({
    type: league_team_daily_values_actions.GET_LEAGUE_TEAM_DAILY_VALUES_FAILED,
    payload: {
      opts,
      error
    }
  }),

  get_league_team_daily_values_pending: (opts) => ({
    type: league_team_daily_values_actions.GET_LEAGUE_TEAM_DAILY_VALUES_PENDING,
    payload: {
      opts
    }
  }),

  get_league_team_daily_values_fulfilled: (opts, data) => ({
    type: league_team_daily_values_actions.GET_LEAGUE_TEAM_DAILY_VALUES_FULFILLED,
    payload: {
      opts,
      data
    }
  })
}

export const get_league_team_daily_values_actions = {
  failed: league_team_daily_values_actions.get_league_team_daily_values_failed,
  pending:
    league_team_daily_values_actions.get_league_team_daily_values_pending,
  fulfilled:
    league_team_daily_values_actions.get_league_team_daily_values_fulfilled
}
