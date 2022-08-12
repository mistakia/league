import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getTeamById } from '@core/teams'
import { getCurrentLeague } from '@core/leagues'
import { playerActions } from '@core/players'
import { getRosterByTeamId, getGroupedPlayersByTeamId } from '@core/rosters'

import LeagueTeam from './league-team'

const mapStateToProps = createSelector(
  getCurrentLeague,
  getRosterByTeamId,
  getTeamById,
  getGroupedPlayersByTeamId,
  (league, roster, team, players) => ({
    league,
    roster,
    picks: team.picks,
    players
  })
)

const mapDispatchToProps = {
  loadTeamPlayers: playerActions.loadTeamPlayers
}

export default connect(mapStateToProps, mapDispatchToProps)(LeagueTeam)
