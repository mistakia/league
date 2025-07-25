import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { roster_actions } from '@core/rosters'
import {
  getAvailablePlayersForCurrentLeague,
  get_rosters_for_current_league,
  get_current_league
} from '@core/selectors'

import AddPlayerDialog from './add-player-dialog'

const map_state_to_props = createSelector(
  getAvailablePlayersForCurrentLeague,
  get_rosters_for_current_league,
  get_current_league,
  (players, rosters, league) => ({ players, rosters, league })
)

const map_dispatch_to_props = {
  add: roster_actions.add
}

export default connect(
  map_state_to_props,
  map_dispatch_to_props
)(AddPlayerDialog)
