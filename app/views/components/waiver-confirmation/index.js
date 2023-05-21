import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import {
  getWaiverById,
  getCurrentPlayers,
  getCurrentTeamRosterRecord,
  getCurrentLeague,
  getCurrentTeam,
  getPlayerStatus
} from '@core/selectors'
import { waiverActions } from '@core/waivers'

import WaiverConfirmation from './waiver-confirmation'

const mapStateToProps = createSelector(
  getCurrentPlayers,
  getCurrentTeamRosterRecord,
  getCurrentLeague,
  getPlayerStatus,
  getCurrentTeam,
  getWaiverById,
  (rosterPlayers, roster, league, status, team, waiver) => ({
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
