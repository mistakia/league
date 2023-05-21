import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { rosterActions } from '@core/rosters'
import {
  getCurrentPlayers,
  getCurrentTeamRosterRecord,
  getCurrentLeague
} from '@core/selectors'

import AddFreeAgentDialog from './add-free-agent-dialog'

const mapStateToProps = createSelector(
  getCurrentPlayers,
  getCurrentTeamRosterRecord,
  getCurrentLeague,
  (rosterPlayers, roster, league) => ({
    rosterPlayers,
    roster,
    league
  })
)

const mapDispatchToProps = {
  addFreeAgent: rosterActions.addFreeAgent
}

export default connect(mapStateToProps, mapDispatchToProps)(AddFreeAgentDialog)
