import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { Roster } from '@libs-shared'
import {
  get_rosters_for_current_league,
  get_teams_for_current_league,
  get_current_league
} from '@core/selectors'

import DashboardTeamSummarySalary from './dashboard-team-summary-salary'

const map_state_to_props = createSelector(
  get_rosters_for_current_league,
  get_teams_for_current_league,
  get_current_league,
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

export default connect(map_state_to_props)(DashboardTeamSummarySalary)
