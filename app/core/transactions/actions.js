import { actions_utils } from '@core/utils'
const { create_api_actions, create_api_action_types } = actions_utils

export const transactions_actions = {
  ...create_api_action_types('GET_TRANSACTIONS'),
  ...create_api_action_types('GET_RELEASE_TRANSACTIONS'),
  ...create_api_action_types('GET_RESERVE_TRANSACTIONS'),

  FILTER_TRANSACTIONS: 'FILTER_TRANSACTIONS',
  filter: ({ leagueId, type, values }) => ({
    type: transactions_actions.FILTER_TRANSACTIONS,
    payload: {
      leagueId,
      type,
      values
    }
  }),

  LOAD_TRANSACTIONS: 'LOAD_TRANSACTIONS',
  load: (leagueId) => ({
    type: transactions_actions.LOAD_TRANSACTIONS,
    payload: {
      leagueId: Number(leagueId)
    }
  }),

  LOAD_NEXT_TRANSACTIONS: 'LOAD_NEXT_TRANSACTIONS',
  load_next_transactions: (leagueId) => ({
    type: transactions_actions.LOAD_NEXT_TRANSACTIONS,
    payload: {
      leagueId
    }
  }),

  LOAD_RECENT_TRANSACTIONS: 'LOAD_RECENT_TRANSACTIONS',
  load_recent_transactions: () => ({
    type: transactions_actions.LOAD_RECENT_TRANSACTIONS
  })
}

export const get_transactions_actions = create_api_actions('GET_TRANSACTIONS')
export const get_release_transactions_actions = create_api_actions(
  'GET_RELEASE_TRANSACTIONS'
)
export const get_reserve_transactions_actions = create_api_actions(
  'GET_RESERVE_TRANSACTIONS'
)
