import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { Roster } from '@common'
import {
  getRostersForCurrentLeague,
  getTeamsForCurrentLeague,
  getCurrentLeague
} from '@core/selectors'

import DashboardTeamSummarySalary from './dashboard-team-summary-salary'

const mapStateToProps = createSelector(
  getRostersForCurrentLeague,
  getTeamsForCurrentLeague,
  getCurrentLeague,
  (records, teams, league) => {
    const rosterRecords = records.toList().toJS()
    const rosters = rosterRecords.map(
      (roster) => new Roster({ roster, league })
    )

    const list = rosters.map((r) => {
      const team = teams.find((t) => t.uid === r.tid, null, {})
      return { uid: r.tid, cap: r.availableCap, name: team.name }
    })
    const sorted = list.sort((a, b) => b.cap - a.cap)
    return { teams: sorted }
  }
)

export default connect(mapStateToProps)(DashboardTeamSummarySalary)
