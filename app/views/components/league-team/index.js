import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import {
  getTeamById,
  getCurrentLeague,
  getRosterByTeamId,
  getGroupedPlayersByTeamId
} from '@core/selectors'
import { playerActions } from '@core/players'

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
