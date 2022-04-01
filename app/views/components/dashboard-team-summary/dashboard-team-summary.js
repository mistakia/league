import React from 'react'

import { constants } from '@common'
import DashboardTeamSummaryFAAB from '@components/dashboard-team-summary-faab'
import DashboardTeamSummarySalary from '@components/dashboard-team-summary-salary'
import DashboardTeamSummaryWaiverOrder from '@components/dashboard-team-summary-waiver-order'
import DashboardTeamSummaryRecord from '@components/dashboard-team-summary-record'
import DashboardTeamSummaryPlayoffOdds from '@components/dashboard-team-summary-playoff-odds'
import DashboardTeamSummaryByeOdds from '@components/dashboard-team-summary-bye-odds'
import DashboardTeamSummaryDivisionOdds from '@components/dashboard-team-summary-division-odds'
import DashboardTeamSummaryChampionshipOdds from '@components/dashboard-team-summary-championship-odds'
import DashboardTeamSummaryFranchiseTags from '@components/dashboard-team-summary-franchise-tags'

const DashboardTeamSummary = () => (
  <div className='dashboard__section-side'>
    <div className='dashboard__section-side-title'>Summary</div>
    <div className='dashboard__section-side-body'>
      {constants.season.isRegularSeason && <DashboardTeamSummaryRecord />}
      {constants.season.isRegularSeason && <DashboardTeamSummaryPlayoffOdds />}
      {constants.season.isRegularSeason && <DashboardTeamSummaryDivisionOdds />}
      {constants.season.isRegularSeason && <DashboardTeamSummaryByeOdds />}
      {constants.season.isRegularSeason && (
        <DashboardTeamSummaryChampionshipOdds />
      )}
      {constants.season.isRegularSeason && <DashboardTeamSummaryFAAB />}
      <DashboardTeamSummarySalary />
      <DashboardTeamSummaryWaiverOrder />
      <DashboardTeamSummaryFranchiseTags />
    </div>
  </div>
)

export default DashboardTeamSummary
