import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { playerActions } from '@core/players'
import { teamActions, getTeamsForCurrentLeague } from '@core/teams'
import { draftPickValueActions } from '@core/draft-pick-value'

import TeamPage from './team'

const mapStateToProps = createSelector(getTeamsForCurrentLeague, (teams) => ({
  teams
}))

const mapDispatchToProps = {
  loadTeams: teamActions.loadTeams,
  loadLeaguePlayers: playerActions.loadLeaguePlayers,
  loadDraftPickValue: draftPickValueActions.loadDraftPickValue,
  loadLeagueTeamStats: teamActions.loadLeagueTeamStats
}

export default connect(mapStateToProps, mapDispatchToProps)(TeamPage)
