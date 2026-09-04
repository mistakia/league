export const plays_view_request_actions = {
  PLAYS_VIEW_POSITION: 'PLAYS_VIEW_POSITION',
  PLAYS_VIEW_STATUS: 'PLAYS_VIEW_STATUS',
  PLAYS_VIEW_RESULT: 'PLAYS_VIEW_RESULT',
  PLAYS_VIEW_ERROR: 'PLAYS_VIEW_ERROR',
  PLAYS_VIEW_REQUEST: 'PLAYS_VIEW_REQUEST',
  PLAYS_VIEW_REQUEST_SKIPPED: 'PLAYS_VIEW_REQUEST_SKIPPED',
  plays_view_request: (payload) => ({
    type: plays_view_request_actions.PLAYS_VIEW_REQUEST,
    payload
  }),
  plays_view_request_skipped: () => ({
    type: plays_view_request_actions.PLAYS_VIEW_REQUEST_SKIPPED
  })
}
