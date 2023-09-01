import React from 'react'
import PropTypes from 'prop-types'

import './auction-league-stats.styl'

export default function AuctionLeagueStats({
  remaining_salary_space,
  remaining_active_roster_space
}) {
  return (
    <div className='auction-league-stats'>
      <div className='auction-league-stat'>
        <label>Salary</label>${remaining_salary_space}
      </div>
      <div className='auction-league-stat'>
        <label>Roster</label>
        {remaining_active_roster_space}
      </div>
    </div>
  )
}

AuctionLeagueStats.propTypes = {
  remaining_salary_space: PropTypes.number.isRequired,
  remaining_active_roster_space: PropTypes.number.isRequired
}
