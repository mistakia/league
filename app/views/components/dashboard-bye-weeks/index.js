import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { get_schedule_state, getGroupedPlayersByTeamId } from '@core/selectors'

import DashboardByeWeeks from './dashboard-bye-weeks'

const map_state_to_props = createSelector(
  getGroupedPlayersByTeamId,
  get_schedule_state,
  (team, schedule) => {
    const byes = {}
    for (const player_map of team.active) {
      const bye = schedule.getIn(['teams', player_map.get('team'), 'bye']) || 0
      if (!byes[bye]) byes[bye] = []
      byes[bye].push(player_map)
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

export default connect(map_state_to_props)(DashboardByeWeeks)
