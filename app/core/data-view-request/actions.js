export const data_view_request_actions = {
  DATA_VIEW_POSITION: 'DATA_VIEW_POSITION',
  DATA_VIEW_STATUS: 'DATA_VIEW_STATUS',
  DATA_VIEW_RESULT: 'DATA_VIEW_RESULT',
  DATA_VIEW_ERROR: 'DATA_VIEW_ERROR',
  DATA_VIEW_REQUEST: 'DATA_VIEW_REQUEST',
  data_view_request: (payload) => ({
    type: data_view_request_actions.DATA_VIEW_REQUEST,
    payload
  })
}
