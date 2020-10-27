import React from 'react'

import DashboardTeamSummaryFAAB from '@components/dashboard-team-summary-faab'
import DashboardTeamSummarySalary from '@components/dashboard-team-summary-salary'
import DashboardTeamSummaryWaiverOrder from '@components/dashboard-team-summary-waiver-order'

const DashboardTeamSummary = () => (
  <div className='dashboard__section-side'>
    <div className='dashboard__section-side-title'>Summary</div>
    <div className='dashboard__section-side-body'>
      <DashboardTeamSummaryFAAB />
      <DashboardTeamSummarySalary />
      <DashboardTeamSummaryWaiverOrder />
    </div>
  </div>
)

export default DashboardTeamSummary
