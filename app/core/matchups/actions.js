import { actions_utils } from '@core/utils'
const { create_api_actions, create_api_action_types } = actions_utils

export const matchups_actions = {
  ...create_api_action_types('GET_MATCHUPS'),
  ...create_api_action_types('POST_MATCHUPS'),

  LOAD_MATCHUPS: 'LOAD_MATCHUPS',
  loadMatchups: ({ year, week }) => ({
    type: matchups_actions.LOAD_MATCHUPS,
    payload: {
      year,
      week
    }
  }),

  SELECT_MATCHUP: 'SELECT_MATCHUP',
  select_matchup: ({ matchupId, week, year }) => ({
    type: matchups_actions.SELECT_MATCHUP,
    payload: {
      matchupId: Number(matchupId),
      week: week !== null && week !== undefined ? Number(week) : undefined,
      year: year !== null && year !== undefined ? Number(year) : undefined
    }
  }),

  FILTER_MATCHUPS: 'FILTER_MATCHUPS',
  filter: ({ type, values }) => ({
    type: matchups_actions.FILTER_MATCHUPS,
    payload: {
      type,
      values
    }
  }),

  GENERATE_MATCHUPS: 'GENERATE_MATCHUPS',
  generate: (leagueId) => ({
    type: matchups_actions.GENERATE_MATCHUPS,
    payload: {
      leagueId
    }
  })
}

export const get_matchups_actions = create_api_actions('GET_MATCHUPS')
export const post_matchups_actions = create_api_actions('POST_MATCHUPS')
