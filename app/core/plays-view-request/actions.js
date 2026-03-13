export const plays_view_request_actions = {
  PLAYS_VIEW_POSITION: 'PLAYS_VIEW_POSITION',
  PLAYS_VIEW_STATUS: 'PLAYS_VIEW_STATUS',
  PLAYS_VIEW_RESULT: 'PLAYS_VIEW_RESULT',
  PLAYS_VIEW_ERROR: 'PLAYS_VIEW_ERROR',
  PLAYS_VIEW_REQUEST: 'PLAYS_VIEW_REQUEST',
  plays_view_request: (payload) => ({
    type: plays_view_request_actions.PLAYS_VIEW_REQUEST,
    payload
  })
}
