import React from 'react'

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
      <DashboardTeamSummaryRecord />
      <DashboardTeamSummaryPlayoffOdds />
      <DashboardTeamSummaryDivisionOdds />
      <DashboardTeamSummaryByeOdds />
      <DashboardTeamSummaryChampionshipOdds />
      <DashboardTeamSummaryFAAB />
      <DashboardTeamSummarySalary />
      <DashboardTeamSummaryWaiverOrder />
      <DashboardTeamSummaryFranchiseTags />
    </div>
  </div>
)

export default DashboardTeamSummary
