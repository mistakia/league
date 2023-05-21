import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getSchedule, getGroupedPlayersByTeamId } from '@core/selectors'

import DashboardByeWeeks from './dashboard-bye-weeks'

const mapStateToProps = createSelector(
  getGroupedPlayersByTeamId,
  getSchedule,
  (team, schedule) => {
    const byes = {}
    for (const playerMap of team.active) {
      const bye = schedule.getIn(['teams', playerMap.get('team'), 'bye']) || 0
      if (!byes[bye]) byes[bye] = []
      byes[bye].push(playerMap)
    }

    Object.keys(byes).forEach((bye, idx) => {
      const players = byes[bye]
      const sorted = players.sort(
        (a, b) =>
          b.getIn(['lineups', 'starts']) - a.getIn(['lineups', 'starts'])
      )
      byes[bye] = sorted
    })

    return { byes }
  }
)

export default connect(mapStateToProps)(DashboardByeWeeks)
