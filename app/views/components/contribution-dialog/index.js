import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { contribution_actions } from '@core/contributions'
import { get_contributions } from '@core/selectors'

import ContributionDialog from './contribution-dialog'

// The whole store is passed through so the context capture can read it. The
// ALLOWLIST in app/core/contribution-context.js is what decides which slices
// and fields actually leave the browser -- handing the state in here is not a
// widening, because nothing downstream reads a field it was not told to.
const map_state_to_props = createSelector(
  get_contributions,
  (state) => state,
  (contributions, state) => ({
    is_open: contributions.get('is_dialog_open'),
    submission_kind: contributions.get('dialog_submission_kind'),
    is_submitting: contributions.get('is_submitting'),
    submit_error: contributions.get('submit_error'),
    receipt: contributions.get('receipt'),
    state
  })
)

// Every name here is resolved against app/core/contributions/actions.js. The
// object form is passed to bindActionCreators, which copies only values that
// are typeof 'function' and DROPS an unknown key with no warning -- no connect
// warning, no lint error, no build failure, and the only symptom is a
// TypeError when a user fires the handler. See docs/guides/spa.md.
const map_dispatch_to_props = {
  open_contribution_dialog: contribution_actions.open_contribution_dialog,
  close_contribution_dialog: contribution_actions.close_contribution_dialog,
  dismiss_contribution_receipt:
    contribution_actions.dismiss_contribution_receipt,
  submit_contribution: contribution_actions.submit_contribution
}

export default connect(
  map_state_to_props,
  map_dispatch_to_props
)(ContributionDialog)
