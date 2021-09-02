import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getTeamEvents } from '@core/teams'
import { getLeagueEvents } from '@core/leagues'

import LeagueSchedule from './league-schedule'

const mapStateToProps = createSelector(
  getTeamEvents,
  getLeagueEvents,
  (teamEvents, leagueEvents) => {
    const events = teamEvents
      .concat(leagueEvents)
      .sort((a, b) => a.date.unix() - b.date.unix())

    return { events }
  }
)

export default connect(mapStateToProps)(LeagueSchedule)
