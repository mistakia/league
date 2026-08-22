import { actions_utils } from '@core/utils'
const { create_api_actions, create_api_action_types } = actions_utils

// Both halves of every request are declared here. Exporting the creators alone
// leaves every reducer case reading `case undefined`, because the SCREAMING_CASE
// type constants come from create_api_action_types and the creators come from
// create_api_actions -- a saga would then dispatch a real string matching
// nothing and the store would never update. See docs/guides/spa.md.
export const contribution_actions = {
  ...create_api_action_types('POST_CONTRIBUTION'),
  ...create_api_action_types('GET_CONTRIBUTIONS'),
  ...create_api_action_types('GET_CONTRIBUTION'),
  ...create_api_action_types('POST_CONTRIBUTION_ANSWER'),

  LOAD_CONTRIBUTIONS: 'LOAD_CONTRIBUTIONS',
  load_contributions: () => ({
    type: contribution_actions.LOAD_CONTRIBUTIONS
  }),

  LOAD_CONTRIBUTION: 'LOAD_CONTRIBUTION',
  load_contribution: ({ submission_id, claim_token = null }) => ({
    type: contribution_actions.LOAD_CONTRIBUTION,
    payload: { submission_id, claim_token }
  }),

  SUBMIT_CONTRIBUTION: 'SUBMIT_CONTRIBUTION',
  submit_contribution: ({
    submission_kind,
    submission_title,
    submission_body,
    captured_context,
    screenshot = null
  }) => ({
    type: contribution_actions.SUBMIT_CONTRIBUTION,
    payload: {
      submission_kind,
      submission_title,
      submission_body,
      captured_context,
      screenshot
    }
  }),

  SUBMIT_CONTRIBUTION_ANSWER: 'SUBMIT_CONTRIBUTION_ANSWER',
  submit_contribution_answer: ({
    submission_id,
    question_id,
    answer_body,
    claim_token = null
  }) => ({
    type: contribution_actions.SUBMIT_CONTRIBUTION_ANSWER,
    payload: { submission_id, question_id, answer_body, claim_token }
  }),

  OPEN_CONTRIBUTION_DIALOG: 'OPEN_CONTRIBUTION_DIALOG',
  open_contribution_dialog: ({ submission_kind = 'bug_report' } = {}) => ({
    type: contribution_actions.OPEN_CONTRIBUTION_DIALOG,
    payload: { submission_kind }
  }),

  CLOSE_CONTRIBUTION_DIALOG: 'CLOSE_CONTRIBUTION_DIALOG',
  close_contribution_dialog: () => ({
    type: contribution_actions.CLOSE_CONTRIBUTION_DIALOG
  }),

  // The claim token is returned exactly once, by the create response. Clearing
  // it is an explicit user act (dismissing the confirmation) rather than a
  // side effect of closing the dialog, so it cannot be lost to a stray click.
  DISMISS_CONTRIBUTION_RECEIPT: 'DISMISS_CONTRIBUTION_RECEIPT',
  dismiss_contribution_receipt: () => ({
    type: contribution_actions.DISMISS_CONTRIBUTION_RECEIPT
  })
}

export const post_contribution_actions = create_api_actions('POST_CONTRIBUTION')
export const get_contributions_actions = create_api_actions('GET_CONTRIBUTIONS')
export const get_contribution_actions = create_api_actions('GET_CONTRIBUTION')
export const post_contribution_answer_actions = create_api_actions(
  'POST_CONTRIBUTION_ANSWER'
)
