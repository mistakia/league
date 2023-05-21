import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getTeamsForCurrentLeague } from '@core/selectors'

import DashboardTeamSummaryChampionshipOdds from './dashboard-team-summary-championship-odds'

const mapStateToProps = createSelector(getTeamsForCurrentLeague, (teams) => {
  const list = teams.toList()
  const sorted = list.sort((a, b) => b.championship_odds - a.championship_odds)
  return { teams: sorted }
})

export default connect(mapStateToProps)(DashboardTeamSummaryChampionshipOdds)
