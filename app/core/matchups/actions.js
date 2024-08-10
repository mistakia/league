import { actions_utils } from '@core/utils'
const { create_api_actions, create_api_action_types } = actions_utils

export const matchupsActions = {
  ...create_api_action_types('GET_MATCHUPS'),
  ...create_api_action_types('POST_MATCHUPS'),

  LOAD_MATCHUPS: 'LOAD_MATCHUPS',
  loadMatchups: ({ year, week }) => ({
    type: matchupsActions.LOAD_MATCHUPS,
    payload: {
      year,
      week
    }
  }),

  SELECT_MATCHUP: 'SELECT_MATCHUP',
  select: ({ matchupId, week, year }) => ({
    type: matchupsActions.SELECT_MATCHUP,
    payload: {
      matchupId: Number(matchupId),
      week: week !== null && week !== undefined ? Number(week) : undefined,
      year: year !== null && year !== undefined ? Number(year) : undefined
    }
  }),

  FILTER_MATCHUPS: 'FILTER_MATCHUPS',
  filter: ({ type, values }) => ({
    type: matchupsActions.FILTER_MATCHUPS,
    payload: {
      type,
      values
    }
  }),

  GENERATE_MATCHUPS: 'GENERATE_MATCHUPS',
  generate: (leagueId) => ({
    type: matchupsActions.GENERATE_MATCHUPS,
    payload: {
      leagueId
    }
  })
}

export const getMatchupsActions = create_api_actions(
  matchupsActions.GET_MATCHUPS
)
export const postMatchupsActions = create_api_actions(
  matchupsActions.POST_MATCHUPS
)
