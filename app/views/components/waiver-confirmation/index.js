import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import {
  isPlayerEligible,
  getCurrentPlayers,
  getCurrentTeamRosterRecord
} from '@core/rosters'
import { getCurrentLeague } from '@core/leagues'
import { getCurrentTeam } from '@core/teams'
import { waiverActions, getWaiverById } from '@core/waivers'
import { getPlayerStatus } from '@core/players'

import WaiverConfirmation from './waiver-confirmation'

const mapStateToProps = createSelector(
  isPlayerEligible,
  getCurrentPlayers,
  getCurrentTeamRosterRecord,
  getCurrentLeague,
  getPlayerStatus,
  getCurrentTeam,
  getWaiverById,
  (isEligible, rosterPlayers, roster, league, status, team, waiver) => ({
    isEligible,
    rosterPlayers,
    roster,
    league,
    status,
    team,
    waiver
  })
)

const mapDispatchToProps = {
  claim: waiverActions.claim,
  update: waiverActions.update
}

export default connect(mapStateToProps, mapDispatchToProps)(WaiverConfirmation)
