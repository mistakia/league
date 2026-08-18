import React from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'

import ScheduleFilter from '@components/schedule-filter'

export default class ScheduleTeamsFilter extends React.Component {
  render = () => {
    const state = {
      type: 'teams',
      label: 'TEAMS',
      values: []
    }

    for (const team of this.props.league_teams) {
      state.values.push({
        value: team.team_id,
        label: team.name,
        selected: this.props.matchup_teams.includes(team.team_id)
      })
    }

    return <ScheduleFilter {...state} />
  }
}

ScheduleTeamsFilter.propTypes = {
  league_teams: ImmutablePropTypes.list,
  matchup_teams: ImmutablePropTypes.list
}
