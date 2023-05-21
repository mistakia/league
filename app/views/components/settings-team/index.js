import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { teamActions } from '@core/teams'
import { getTeamById, getCurrentLeague } from '@core/selectors'

import SettingsTeam from './settings-team'

const mapStateToProps = createSelector(
  getTeamById,
  getCurrentLeague,
  (team, league) => ({ team, isHosted: Boolean(league.hosted) })
)

const mapDispatchToProps = {
  update: teamActions.update
}

export default connect(mapStateToProps, mapDispatchToProps)(SettingsTeam)
