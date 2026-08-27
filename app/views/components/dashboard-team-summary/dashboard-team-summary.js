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
import { current_season } from '#constants'

export default function DashboardTeamSummary({ tid }) {
  // NOT current_season.is_regular_season, which is weeks 1-17 and so includes
  // the fantasy playoffs. This is the narrower window the odds panels want --
  // at or before the fantasy regular-season final week -- and it is also true
  // in the offseason, when week is 0.
  const is_before_fantasy_playoffs =
    current_season.week <= current_season.regular_season_final_week

  return (
    <div className='league-team-section-side'>
      {current_season.is_regular_season && (
        <DashboardTeamSummaryRecord tid={tid} />
      )}
      {is_before_fantasy_playoffs && (
        <DashboardTeamSummaryPlayoffOdds tid={tid} />
      )}
      {is_before_fantasy_playoffs && (
        <DashboardTeamSummaryDivisionOdds tid={tid} />
      )}
      {is_before_fantasy_playoffs && <DashboardTeamSummaryByeOdds tid={tid} />}
      {current_season.is_regular_season && (
        <DashboardTeamSummaryChampionshipOdds tid={tid} />
      )}
      {current_season.is_regular_season && (
        <DashboardTeamSummaryFAAB tid={tid} />
      )}
      <DashboardTeamSummarySalary tid={tid} />
      <DashboardTeamSummaryWaiverOrder tid={tid} />
      <DashboardTeamSummaryFranchiseTags tid={tid} />
    </div>
  )
}

DashboardTeamSummary.propTypes = {
  tid: PropTypes.number
}
