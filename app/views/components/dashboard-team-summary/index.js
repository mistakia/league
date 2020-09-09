import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { Roster } from '@common'
import { getTeamsForCurrentLeague } from '@core/teams'
import { getRostersForCurrentLeague } from '@core/rosters'
import { getCurrentLeague } from '@core/leagues'
import { getApp } from '@core/app'

import DashboardTeamSummary from './dashboard-team-summary'

const mapStateToProps = createSelector(
  getTeamsForCurrentLeague,
  getRostersForCurrentLeague,
  getCurrentLeague,
  getApp,
  (teams, rosters, league, app) => {
    const ts = teams.valueSeq().toJS()
    const team = ts.find(t => t.uid === app.teamId)
    const faabs = ts.map(t => t.faab).sort((a, b) => b - a)
    const faabRank = faabs.indexOf(team.faab) + 1
    const rosterRecords = rosters.valueSeq().toJS()
    const rs = rosterRecords.map(r => new Roster({ roster: r, league }))
    const roster = rs.find(r => r.tid === app.teamId) || {}

    const caps = rs.map(r => r.availableCap).sort((a, b) => b - a)
    const capRank = caps.indexOf(roster.availableCap) + 1

    const lineups = rosters.getIn([app.teamId, 'lineups'], [])
    const projectedPoint = lineups.reduce((sum, l) => sum + l.total, 0)
    const projectedPointAvg = ((projectedPoint / lineups.size) || 0).toFixed(1)
    const projectedPoints = rosterRecords
      .map(r => Object.values(r.lineups).reduce((sum, l) => sum + l.total, 0))
      .sort((a, b) => b - a)
    const projectedPointRank = projectedPoints.indexOf(projectedPoint) + 1

    return {
      team,
      faabRank,
      league,
      capRank,
      cap: roster.availableCap,
      projectedPoint,
      projectedPointAvg,
      projectedPointRank
    }
  }
)

export default connect(
  mapStateToProps
)(DashboardTeamSummary)
