import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { roster_actions } from '@core/rosters'
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
  add_free_agent: roster_actions.add_free_agent
}

export default connect(mapStateToProps, mapDispatchToProps)(AddFreeAgentDialog)
