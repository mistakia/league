import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { roster_actions } from '@core/rosters'
import { get_current_players_for_league } from '@core/selectors'

import ActivateConfirmation from './activate-confirmation'

const map_state_to_props = createSelector(
  get_current_players_for_league,
  (team) => ({
    team
  })
)

const map_dispatch_to_props = {
  activate: roster_actions.activate
}

export default connect(
  map_state_to_props,
  map_dispatch_to_props
)(ActivateConfirmation)
