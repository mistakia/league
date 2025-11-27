import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { roster_actions } from '@core/rosters'
import {
  get_current_players_for_league,
  isPlayerPracticeSquadEligible
} from '@core/selectors'

import ActivateConfirmation from './activate-confirmation'

const map_state_to_props = createSelector(
  (state) => state,
  get_current_players_for_league,
  (state, team) => {
    // Compute psquad-eligible active players for deactivation candidates
    const psquad_eligible_active_players = team.active.filter((player_map) =>
      isPlayerPracticeSquadEligible(state, { player_map })
    )

    return {
      team,
      psquad_eligible_active_players
    }
  }
)

const map_dispatch_to_props = {
  activate: roster_actions.activate
}

export default connect(
  map_state_to_props,
  map_dispatch_to_props
)(ActivateConfirmation)
