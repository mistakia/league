import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getTeamEvents, get_league_events } from '@core/selectors'

import LeagueSchedule from './league-schedule'

const map_state_to_props = createSelector(
  getTeamEvents,
  get_league_events,
  (teamEvents, leagueEvents) => {
    const events = teamEvents
      .concat(leagueEvents)
      .sort((a, b) => a.date.unix() - b.date.unix())

    return { events }
  }
)

export default connect(map_state_to_props)(LeagueSchedule)
