import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { playerActions } from '@core/players'
import { teamActions, getTeamsForCurrentLeague } from '@core/teams'

import TeamPage from './team'

const mapStateToProps = createSelector(getTeamsForCurrentLeague, (teams) => ({
  teams
}))

const mapDispatchToProps = {
  loadTeams: teamActions.loadTeams,
  loadLeaguePlayers: playerActions.loadLeaguePlayers
}

export default connect(mapStateToProps, mapDispatchToProps)(TeamPage)
