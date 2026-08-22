import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { contribution_actions } from '@core/contributions'
import { get_app, get_contributions } from '@core/selectors'

import ContributionsPage from './contributions'

const map_state_to_props = createSelector(
  get_contributions,
  get_app,
  (contributions, app) => ({
    contributions,
    is_logged_in: Boolean(app.userId)
  })
)

// Every name resolved against app/core/contributions/actions.js -- an unknown
// key here is dropped by bindActionCreators with no warning at all.
const map_dispatch_to_props = {
  load_contributions: contribution_actions.load_contributions,
  load_contribution: contribution_actions.load_contribution,
  submit_contribution_answer: contribution_actions.submit_contribution_answer,
  open_contribution_dialog: contribution_actions.open_contribution_dialog
}

export default connect(
  map_state_to_props,
  map_dispatch_to_props
)(ContributionsPage)
