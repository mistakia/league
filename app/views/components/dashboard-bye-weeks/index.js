import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getCurrentPlayers } from '@core/rosters'
import { getSchedule } from '@core/schedule'

import DashboardByeWeeks from './dashboard-bye-weeks'

const mapStateToProps = createSelector(
  getCurrentPlayers,
  getSchedule,
  (team, schedule) => {
    const byes = {}
    for (const player of team.active) {
      const bye = schedule.getIn(['teams', player.team, 'bye']) || 0
      if (!byes[bye]) byes[bye] = []
      byes[bye].push(player)
    }

    return { byes }
  }
)

export default connect(mapStateToProps)(DashboardByeWeeks)
