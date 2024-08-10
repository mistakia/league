import { actions_utils } from '@core/utils'
const { create_api_actions, create_api_action_types } = actions_utils

export const transactionsActions = {
  ...create_api_action_types('GET_TRANSACTIONS'),
  ...create_api_action_types('GET_RELEASE_TRANSACTIONS'),
  ...create_api_action_types('GET_RESERVE_TRANSACTIONS'),

  FILTER_TRANSACTIONS: 'FILTER_TRANSACTIONS',
  filter: ({ leagueId, type, values }) => ({
    type: transactionsActions.FILTER_TRANSACTIONS,
    payload: {
      leagueId,
      type,
      values
    }
  }),

  LOAD_TRANSACTIONS: 'LOAD_TRANSACTIONS',
  load: (leagueId) => ({
    type: transactionsActions.LOAD_TRANSACTIONS,
    payload: {
      leagueId: Number(leagueId)
    }
  }),

  LOAD_NEXT_TRANSACTIONS: 'LOAD_NEXT_TRANSACTIONS',
  loadNext: (leagueId) => ({
    type: transactionsActions.LOAD_NEXT_TRANSACTIONS,
    payload: {
      leagueId
    }
  }),

  LOAD_RECENT_TRANSACTIONS: 'LOAD_RECENT_TRANSACTIONS',
  loadRecentTransactions: () => ({
    type: transactionsActions.LOAD_RECENT_TRANSACTIONS
  })
}

export const getTransactionsActions = create_api_actions('GET_TRANSACTIONS')
export const getReleaseTransactionsActions = create_api_actions(
  'GET_RELEASE_TRANSACTIONS'
)
export const getReserveTransactionsActions = create_api_actions(
  'GET_RESERVE_TRANSACTIONS'
)
