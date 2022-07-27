import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getOverallStandings, teamActions } from '@core/teams'
import { getStandingsYear } from '@core/standings'

import StandingsPage from './standings'

const mapStateToProps = createSelector(
  getOverallStandings,
  getStandingsYear,
  (standings, year) => ({
    standings,
    year,
    division_teams_sorted: standings.divisionTeams.sortBy(
      (v, k) => k,
      (a, b) => a - b
    )
  })
)

const mapDispatchToProps = {
  load: teamActions.loadLeagueTeamStats
}

export default connect(mapStateToProps, mapDispatchToProps)(StandingsPage)
