import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getTeamsForCurrentLeague } from '@core/selectors'
import { player_actions } from '@core/players'
import { teamActions } from '@core/teams'
import { draftPickValueActions } from '@core/draft-pick-value'
import { league_careerlogs_actions } from '@core/league-careerlogs'

import TeamPage from './team'

const mapStateToProps = createSelector(getTeamsForCurrentLeague, (teams) => ({
  teams
}))

const mapDispatchToProps = {
  loadTeams: teamActions.loadTeams,
  load_league_players: player_actions.load_league_players,
  loadDraftPickValue: draftPickValueActions.loadDraftPickValue,
  loadLeagueTeamStats: teamActions.loadLeagueTeamStats,
  load_league_careerlogs: league_careerlogs_actions.load_league_careerlogs
}

export default connect(mapStateToProps, mapDispatchToProps)(TeamPage)
