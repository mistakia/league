import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { teamActions } from '@core/teams'
import { getOverallStandings, get_app, getCurrentLeague } from '@core/selectors'

import StandingsPage from './standings'

const mapStateToProps = createSelector(
  getOverallStandings,
  get_app,
  getCurrentLeague,
  (standings, app, league) => ({
    standings,
    year: app.year,
    league,
    division_teams_sorted: standings.divisionTeams.sortBy(
      (v, k) => k,
      (a, b) => a - b
    )
  })
)

const mapDispatchToProps = {
  loadLeagueTeamStats: teamActions.loadLeagueTeamStats
}

export default connect(mapStateToProps, mapDispatchToProps)(StandingsPage)
