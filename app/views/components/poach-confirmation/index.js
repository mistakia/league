import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import {
  get_current_players_for_league,
  get_current_team_roster_record,
  getRosterInfoForPlayerId,
  get_current_league,
  getPoachById,
  getPoachReleasePlayers,
  getPlayerStatus
} from '@core/selectors'
import { poach_actions } from '@core/poaches'
import { waiver_actions } from '@core/waivers'

import PoachConfirmation from './poach-confirmation'

const map_state_to_props = createSelector(
  get_current_players_for_league,
  get_current_team_roster_record,
  get_current_league,
  getPlayerStatus,
  getRosterInfoForPlayerId,
  getPoachById,
  getPoachReleasePlayers,
  (team, roster, league, status, rosterInfo, poach, releasePlayers) => ({
    team,
    roster,
    league,
    status,
    rosterInfo,
    poach,
    releasePlayers
  })
)

const map_dispatch_to_props = {
  submitWaiverClaim: waiver_actions.claim,
  submitPoach: poach_actions.poach,
  updatePoach: poach_actions.update
}

export default connect(
  map_state_to_props,
  map_dispatch_to_props
)(PoachConfirmation)
