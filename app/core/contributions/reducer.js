import { List, Map, fromJS } from 'immutable'

import { contribution_actions } from './actions'

// Deliberately a Map rather than a Record for the wire rows. An Immutable
// Record silently discards any key its declaration does not list, so a column
// added to contribution_submissions would reach the client as undefined with
// no warning anywhere -- the trap documented in docs/guides/spa.md. The row
// shape here is server-owned and expected to grow, so fromJS keeps the client
// honest about whatever the route actually sent.
const initial_state = new Map({
  is_dialog_open: false,
  dialog_submission_kind: 'bug_report',

  is_submitting: false,
  submit_error: null,

  // The claim token lives here and ONLY here: it is returned once by the create
  // response and is never persisted, because it is a bearer credential for one
  // submitter's report and its captured context.
  receipt: null,

  is_loading: false,
  submissions: new List(),
  submission_detail: new Map(),

  is_answering: false
})

export function contribution_reducer(state = initial_state, { payload, type }) {
  switch (type) {
    case contribution_actions.OPEN_CONTRIBUTION_DIALOG:
      return state.merge({
        is_dialog_open: true,
        dialog_submission_kind: payload.submission_kind,
        submit_error: null
      })

    case contribution_actions.CLOSE_CONTRIBUTION_DIALOG:
      return state.set('is_dialog_open', false)

    case contribution_actions.DISMISS_CONTRIBUTION_RECEIPT:
      return state.set('receipt', null)

    case contribution_actions.POST_CONTRIBUTION_PENDING:
      return state.merge({ is_submitting: true, submit_error: null })

    case contribution_actions.POST_CONTRIBUTION_FAILED:
      return state.merge({ is_submitting: false, submit_error: payload.error })

    case contribution_actions.POST_CONTRIBUTION_FULFILLED:
      return state.merge({
        is_submitting: false,
        submit_error: null,
        is_dialog_open: false,
        receipt: fromJS(payload.data)
      })

    case contribution_actions.GET_CONTRIBUTIONS_PENDING:
      return state.set('is_loading', true)

    case contribution_actions.GET_CONTRIBUTIONS_FAILED:
      return state.set('is_loading', false)

    case contribution_actions.GET_CONTRIBUTIONS_FULFILLED:
      return state
        .set('is_loading', false)
        .set('submissions', fromJS(payload.data || []))

    case contribution_actions.GET_CONTRIBUTION_PENDING:
      return state.set('is_loading', true)

    case contribution_actions.GET_CONTRIBUTION_FAILED:
      return state.set('is_loading', false)

    case contribution_actions.GET_CONTRIBUTION_FULFILLED:
      return state
        .set('is_loading', false)
        .setIn(
          ['submission_detail', payload.data.submission_id],
          fromJS(payload.data)
        )

    case contribution_actions.POST_CONTRIBUTION_ANSWER_PENDING:
      return state.set('is_answering', true)

    case contribution_actions.POST_CONTRIBUTION_ANSWER_FAILED:
      return state.set('is_answering', false)

    case contribution_actions.POST_CONTRIBUTION_ANSWER_FULFILLED:
      return state.set('is_answering', false)

    default:
      return state
  }
}
