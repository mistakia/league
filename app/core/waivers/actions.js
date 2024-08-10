import { actions_utils } from '@core/utils'
const { create_api_actions, create_api_action_types } = actions_utils

export const waiverActions = {
  ...create_api_action_types('POST_WAIVER'),
  ...create_api_action_types('PUT_WAIVER'),
  ...create_api_action_types('POST_CANCEL_WAIVER'),
  ...create_api_action_types('POST_WAIVER_ORDER'),
  ...create_api_action_types('GET_WAIVERS'),
  ...create_api_action_types('GET_WAIVER_REPORT'),

  FILTER_WAIVERS: 'FILTER_WAIVERS',
  filter: ({ type, values }) => ({
    type: waiverActions.FILTER_WAIVERS,
    payload: {
      type,
      values
    }
  }),

  LOAD_WAIVERS: 'LOAD_WAIVERS',
  loadWaivers: (leagueId) => ({
    type: waiverActions.LOAD_WAIVERS,
    payload: {
      leagueId: Number(leagueId)
    }
  }),

  REORDER_WAIVERS: 'REORDER_WAIVERS',
  reorderWaivers: ({ oldIndex, newIndex, type }) => ({
    type: waiverActions.REORDER_WAIVERS,
    payload: {
      oldIndex,
      newIndex,
      type
    }
  }),

  WAIVER_CLAIM: 'WAIVER_CLAIM',
  claim: ({ pid, bid, release, type }) => ({
    type: waiverActions.WAIVER_CLAIM,
    payload: {
      pid,
      bid,
      release,
      type
    }
  }),

  UPDATE_WAIVER_CLAIM: 'UPDATE_WAIVER_CLAIM',
  update: ({ waiverId, release, bid }) => ({
    type: waiverActions.UPDATE_WAIVER_CLAIM,
    payload: {
      waiverId,
      release,
      bid
    }
  }),

  CANCEL_CLAIM: 'CANCEL_CLAIM',
  cancel: (waiverId) => ({
    type: waiverActions.CANCEL_CLAIM,
    payload: {
      waiverId
    }
  })
}

export const postWaiverActions = create_api_actions(waiverActions.POST_WAIVER)
export const putWaiverActions = create_api_actions(waiverActions.PUT_WAIVER)
export const postCancelWaiverActions = create_api_actions(
  waiverActions.POST_CANCEL_WAIVER
)
export const postWaiverOrderActions = create_api_actions(
  waiverActions.POST_WAIVER_ORDER
)
export const getWaiversActions = create_api_actions(waiverActions.GET_WAIVERS)
export const getWaiverReportActions = create_api_actions(
  waiverActions.GET_WAIVER_REPORT
)
