export const data_view_request_actions = {
  DATA_VIEW_POSITION: 'DATA_VIEW_POSITION',
  DATA_VIEW_STATUS: 'DATA_VIEW_STATUS',
  DATA_VIEW_RESULT: 'DATA_VIEW_RESULT',
  DATA_VIEW_ERROR: 'DATA_VIEW_ERROR',
  DATA_VIEW_REQUEST: 'DATA_VIEW_REQUEST',
  DATA_VIEW_PARAM_OPTION_COUNTS_FULFILLED:
    'DATA_VIEW_PARAM_OPTION_COUNTS_FULFILLED',
  DATA_VIEW_PARAM_OPTION_COUNTS_SIGNATURE_SET:
    'DATA_VIEW_PARAM_OPTION_COUNTS_SIGNATURE_SET',
  data_view_request: (payload) => ({
    type: data_view_request_actions.DATA_VIEW_REQUEST,
    payload
  }),
  param_option_counts_fulfilled: ({ target_param_name, counts }) => ({
    type: data_view_request_actions.DATA_VIEW_PARAM_OPTION_COUNTS_FULFILLED,
    payload: { target_param_name, counts }
  }),
  param_option_counts_signature_set: ({ view_id, signature }) => ({
    type: data_view_request_actions.DATA_VIEW_PARAM_OPTION_COUNTS_SIGNATURE_SET,
    payload: { view_id, signature }
  })
}
