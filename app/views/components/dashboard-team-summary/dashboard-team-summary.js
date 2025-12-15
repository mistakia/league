import React from 'react'
import PropTypes from 'prop-types'

import DashboardTeamSummaryFAAB from '@components/dashboard-team-summary-faab'
import DashboardTeamSummarySalary from '@components/dashboard-team-summary-salary'
import DashboardTeamSummaryWaiverOrder from '@components/dashboard-team-summary-waiver-order'
import DashboardTeamSummaryRecord from '@components/dashboard-team-summary-record'
import DashboardTeamSummaryPlayoffOdds from '@components/dashboard-team-summary-playoff-odds'
import DashboardTeamSummaryByeOdds from '@components/dashboard-team-summary-bye-odds'
import DashboardTeamSummaryDivisionOdds from '@components/dashboard-team-summary-division-odds'
import DashboardTeamSummaryChampionshipOdds from '@components/dashboard-team-summary-championship-odds'
import DashboardTeamSummaryFranchiseTags from '@components/dashboard-team-summary-franchise-tags'
import { current_season } from '@constants'

export default function DashboardTeamSummary({ tid }) {
  const is_regular_season =
    current_season.week <= current_season.regularSeasonFinalWeek

  return (
    <div className='league-team-section-side'>
      {current_season.isRegularSeason && (
        <DashboardTeamSummaryRecord tid={tid} />
      )}
      {is_regular_season && <DashboardTeamSummaryPlayoffOdds tid={tid} />}
      {is_regular_season && <DashboardTeamSummaryDivisionOdds tid={tid} />}
      {is_regular_season && <DashboardTeamSummaryByeOdds tid={tid} />}
      {current_season.isRegularSeason && (
        <DashboardTeamSummaryChampionshipOdds tid={tid} />
      )}
      {current_season.isRegularSeason && <DashboardTeamSummaryFAAB tid={tid} />}
      <DashboardTeamSummarySalary tid={tid} />
      <DashboardTeamSummaryWaiverOrder tid={tid} />
      <DashboardTeamSummaryFranchiseTags tid={tid} />
    </div>
  )
}

DashboardTeamSummary.propTypes = {
  tid: PropTypes.number
}
