import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getOverallStandings, teamActions } from '@core/teams'
import { getApp } from '@core/app'

import StandingsPage from './standings'

const mapStateToProps = createSelector(
  getOverallStandings,
  getApp,
  (standings, app) => ({
    standings,
    year: app.year,
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
