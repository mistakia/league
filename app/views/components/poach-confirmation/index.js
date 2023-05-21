import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import {
  getCurrentPlayers,
  getCurrentTeamRosterRecord,
  getRosterInfoForPlayerId,
  getCurrentLeague,
  getPoachById,
  getPoachReleasePlayers,
  getPlayerStatus
} from '@core/selectors'
import { poachActions } from '@core/poaches'
import { waiverActions } from '@core/waivers'

import PoachConfirmation from './poach-confirmation'

const mapStateToProps = createSelector(
  getCurrentPlayers,
  getCurrentTeamRosterRecord,
  getCurrentLeague,
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

const mapDispatchToProps = {
  submitWaiverClaim: waiverActions.claim,
  submitPoach: poachActions.poach,
  updatePoach: poachActions.update
}

export default connect(mapStateToProps, mapDispatchToProps)(PoachConfirmation)
