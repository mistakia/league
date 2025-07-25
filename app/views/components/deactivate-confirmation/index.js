import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { get_current_players_for_league } from '@core/selectors'
import { roster_actions } from '@core/rosters'
import { player_actions } from '@core/players'

import DeactivateConfirmation from './deactivate-confirmation'

const map_state_to_props = createSelector(
  get_current_players_for_league,
  (team) => ({
    team
  })
)

const map_dispatch_to_props = {
  deactivate: roster_actions.deactivate,
  load_player_transactions: player_actions.load_player_transactions
}

export default connect(
  map_state_to_props,
  map_dispatch_to_props
)(DeactivateConfirmation)
