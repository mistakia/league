import { actions_utils } from '@core/utils'
const { create_api_actions, create_api_action_types } = actions_utils

export const trade_review_actions = {
  ...create_api_action_types('GET_TRADE_REVIEW'),
  ...create_api_action_types('GET_TRADE_REVIEW_TRADE'),

  LOAD_TRADE_REVIEW: 'LOAD_TRADE_REVIEW',
  load_trade_review: ({ leagueId }) => ({
    type: trade_review_actions.LOAD_TRADE_REVIEW,
    payload: {
      leagueId: Number(leagueId)
    }
  }),

  // One trade's full lineage chains, fetched when a row is expanded. The list
  // response omits chains -- they are an order of magnitude more data than the
  // rest of a row and nothing collapsed renders them.
  LOAD_TRADE_REVIEW_TRADE: 'LOAD_TRADE_REVIEW_TRADE',
  load_trade_review_trade: ({ leagueId, trade_uid }) => ({
    type: trade_review_actions.LOAD_TRADE_REVIEW_TRADE,
    payload: {
      leagueId: Number(leagueId),
      trade_uid: Number(trade_uid)
    }
  })
}

export const get_trade_review_actions = create_api_actions('GET_TRADE_REVIEW')
export const get_trade_review_trade_actions = create_api_actions(
  'GET_TRADE_REVIEW_TRADE'
)
