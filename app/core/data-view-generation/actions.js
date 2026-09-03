// Client actions for agentic data view generation.
//
// THREE OF THESE ARE SERVER FRAMES, NOT ACTION CREATORS. The websocket service
// dispatches every inbound message straight into the store as an action
// (`store.dispatch(message)` in app/core/ws/service.js), so
// DATA_VIEW_GENERATION_ACCEPTED, _UPDATE and _ERROR arrive already shaped as
// `{type, payload}` and need only a reducer case. They are named here so the
// reducer switches on a constant rather than on a string literal, and so the
// wire vocabulary is readable in one place beside the two the client sends.
//
// The two the client originates are the submit trigger and the dismiss. Both
// are watched by sagas rather than handled by the reducer alone, because
// sending on the socket is a side effect.

export const data_view_generation_actions = {
  // --- server frames (inbound) ---
  DATA_VIEW_GENERATION_ACCEPTED: 'DATA_VIEW_GENERATION_ACCEPTED',
  DATA_VIEW_GENERATION_UPDATE: 'DATA_VIEW_GENERATION_UPDATE',
  DATA_VIEW_GENERATION_ERROR: 'DATA_VIEW_GENERATION_ERROR',

  // --- client triggers (outbound) ---
  DATA_VIEW_GENERATION_SUBMIT: 'DATA_VIEW_GENERATION_SUBMIT',
  submit_data_view_generation: ({ instruction, table_state = null }) => ({
    type: data_view_generation_actions.DATA_VIEW_GENERATION_SUBMIT,
    payload: { instruction, table_state }
  }),

  DATA_VIEW_GENERATION_DISMISS: 'DATA_VIEW_GENERATION_DISMISS',
  dismiss_data_view_generation: () => ({
    type: data_view_generation_actions.DATA_VIEW_GENERATION_DISMISS,
    payload: {}
  }),

  // Re-attach to a run this browser started before a reload. Dispatched by the
  // page on mount when a stored generation_id survives; the saga sends
  // DATA_VIEW_GENERATION_COLLECT and the server answers with an _UPDATE frame.
  DATA_VIEW_GENERATION_RESUME: 'DATA_VIEW_GENERATION_RESUME',
  resume_data_view_generation: ({ generation_id }) => ({
    type: data_view_generation_actions.DATA_VIEW_GENERATION_RESUME,
    payload: { generation_id }
  })
}
