import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { isPlayerEligible, getCurrentPlayers, getCurrentTeamRosterRecord } from '@core/rosters'
import { getCurrentLeague } from '@core/leagues'
import { getCurrentTeam } from '@core/teams'
import { waiverActions } from '@core/waivers'

import WaiverConfirmation from './waiver-confirmation'

const mapStateToProps = createSelector(
  isPlayerEligible,
  getCurrentPlayers,
  getCurrentTeamRosterRecord,
  getCurrentLeague,
  getCurrentTeam,
  (isEligible, rosterPlayers, roster, league, team) => ({
    isEligible,
    rosterPlayers,
    roster,
    league,
    team
  })
)

const mapDispatchToProps = {
  claim: waiverActions.claim
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(WaiverConfirmation)
