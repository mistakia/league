import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import {
  get_current_league,
  get_current_players_for_league
} from '@core/selectors'
import { roster_actions } from '@core/rosters'

import RemoveTagConfirmation from './remove-tag-confirmation'

const map_state_to_props = createSelector(
  get_current_league,
  get_current_players_for_league,
  (league, team) => ({
    league,
    team
  })
)

const map_dispatch_to_props = {
  remove: roster_actions.removeTag
}

export default connect(
  map_state_to_props,
  map_dispatch_to_props
)(RemoveTagConfirmation)
