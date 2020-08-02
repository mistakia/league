import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import {
  isPlayerEligible,
  getCurrentPlayers,
  getCurrentTeamRoster,
  getRosterInfoForPlayerId
} from '@core/rosters'
import { getCurrentLeague } from '@core/leagues'
import { poachActions } from '@core/poaches'
import { getPlayerStatus } from '@core/players'
import { waiverActions } from '@core/waivers'

import PoachConfirmation from './poach-confirmation'

const mapStateToProps = createSelector(
  isPlayerEligible,
  getCurrentPlayers,
  getCurrentTeamRoster,
  getCurrentLeague,
  getPlayerStatus,
  getRosterInfoForPlayerId,
  (isPlayerEligible, rosterPlayers, roster, league, status, rosterInfo) => ({
    isPlayerEligible,
    rosterPlayers,
    roster,
    league,
    status,
    rosterInfo
  })
)

const mapDispatchToProps = {
  claim: waiverActions.claim,
  poach: poachActions.poach
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(PoachConfirmation)
