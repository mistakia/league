import { actions_utils } from '@core/utils'
const { create_api_actions, create_api_action_types } = actions_utils

export const waiver_actions = {
  ...create_api_action_types('POST_WAIVER'),
  ...create_api_action_types('PUT_WAIVER'),
  ...create_api_action_types('POST_CANCEL_WAIVER'),
  ...create_api_action_types('POST_WAIVER_ORDER'),
  ...create_api_action_types('GET_WAIVERS'),
  ...create_api_action_types('GET_WAIVER_REPORT'),

  FILTER_WAIVERS: 'FILTER_WAIVERS',
  filter: ({ type, values }) => ({
    type: waiver_actions.FILTER_WAIVERS,
    payload: {
      type,
      values
    }
  }),

  LOAD_WAIVERS: 'LOAD_WAIVERS',
  loadWaivers: (leagueId) => ({
    type: waiver_actions.LOAD_WAIVERS,
    payload: {
      leagueId: Number(leagueId)
    }
  }),

  REORDER_WAIVERS: 'REORDER_WAIVERS',
  reorderWaivers: ({ oldIndex, newIndex, type }) => ({
    type: waiver_actions.REORDER_WAIVERS,
    payload: {
      oldIndex,
      newIndex,
      type
    }
  }),

  WAIVER_CLAIM: 'WAIVER_CLAIM',
  claim: ({ pid, bid, release, type }) => ({
    type: waiver_actions.WAIVER_CLAIM,
    payload: {
      pid,
      bid,
      release,
      type
    }
  }),

  UPDATE_WAIVER_CLAIM: 'UPDATE_WAIVER_CLAIM',
  update: ({ waiverId, release, bid }) => ({
    type: waiver_actions.UPDATE_WAIVER_CLAIM,
    payload: {
      waiverId,
      release,
      bid
    }
  }),

  CANCEL_CLAIM: 'CANCEL_CLAIM',
  cancel: (waiverId) => ({
    type: waiver_actions.CANCEL_CLAIM,
    payload: {
      waiverId
    }
  })
}

export const post_waiver_actions = create_api_actions('POST_WAIVER')
export const put_waiver_actions = create_api_actions('PUT_WAIVER')
export const post_cancel_waiver_actions =
  create_api_actions('POST_CANCEL_WAIVER')
export const post_waiver_order_actions = create_api_actions('POST_WAIVER_ORDER')
export const get_waivers_actions = create_api_actions('GET_WAIVERS')
export const get_waiver_report_actions = create_api_actions('GET_WAIVER_REPORT')
