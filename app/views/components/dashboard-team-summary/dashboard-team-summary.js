import React from 'react'
import PropTypes from 'prop-types'

import { constants } from '@libs-shared'
import DashboardTeamSummaryFAAB from '@components/dashboard-team-summary-faab'
import DashboardTeamSummarySalary from '@components/dashboard-team-summary-salary'
import DashboardTeamSummaryWaiverOrder from '@components/dashboard-team-summary-waiver-order'
import DashboardTeamSummaryRecord from '@components/dashboard-team-summary-record'
import DashboardTeamSummaryPlayoffOdds from '@components/dashboard-team-summary-playoff-odds'
import DashboardTeamSummaryByeOdds from '@components/dashboard-team-summary-bye-odds'
import DashboardTeamSummaryDivisionOdds from '@components/dashboard-team-summary-division-odds'
import DashboardTeamSummaryChampionshipOdds from '@components/dashboard-team-summary-championship-odds'
import DashboardTeamSummaryFranchiseTags from '@components/dashboard-team-summary-franchise-tags'

export default function DashboardTeamSummary({ tid }) {
  return (
    <div className='league-team-section-side'>
      <div className='league-team-section-side-body'>
        {constants.isRegularSeason && <DashboardTeamSummaryRecord tid={tid} />}
        {constants.isRegularSeason && (
          <DashboardTeamSummaryPlayoffOdds tid={tid} />
        )}
        {constants.isRegularSeason && (
          <DashboardTeamSummaryDivisionOdds tid={tid} />
        )}
        {constants.isRegularSeason && <DashboardTeamSummaryByeOdds tid={tid} />}
        {constants.isRegularSeason && (
          <DashboardTeamSummaryChampionshipOdds tid={tid} />
        )}
        {constants.isRegularSeason && <DashboardTeamSummaryFAAB tid={tid} />}
        <DashboardTeamSummarySalary tid={tid} />
        <DashboardTeamSummaryWaiverOrder tid={tid} />
        <DashboardTeamSummaryFranchiseTags tid={tid} />
      </div>
    </div>
  )
}

DashboardTeamSummary.propTypes = {
  tid: PropTypes.number
}
