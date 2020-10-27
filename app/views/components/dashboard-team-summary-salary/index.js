import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { Roster } from '@common'
import { getApp } from '@core/app'
import { getTeamsForCurrentLeague } from '@core/teams'
import { getCurrentLeague } from '@core/leagues'
import { getRostersForCurrentLeague } from '@core/rosters'

import DashboardTeamSummarySalary from './dashboard-team-summary-salary'

const mapStateToProps = createSelector(
  getApp,
  getRostersForCurrentLeague,
  getTeamsForCurrentLeague,
  getCurrentLeague,
  (app, records, teams, league) => {
    const rosterRecords = records.toList().toJS()
    const rosters = rosterRecords.map(roster => new Roster({ roster, league }))

    const list = rosters.map(r => {
      const team = teams.find(t => t.uid === r.tid, null, {})
      return { uid: r.tid, cap: r.availableCap, name: team.name }
    })
    const team = list.find(t => t.uid === app.teamId) || {}
    const sorted = list.sort((a, b) => b.cap - a.cap)
    const rank = sorted.findIndex(t => t.uid === app.teamId) + 1
    return { teams: sorted, team, rank }
  }
)

export default connect(
  mapStateToProps
)(DashboardTeamSummarySalary)
