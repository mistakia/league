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

    for (const team of this.props.leagueTeams) {
      state.values.push({
        value: team.uid,
        label: team.name,
        selected: this.props.teams.includes(team.uid)
      })
    }

    return <ScheduleFilter {...state} />
  }
}

ScheduleTeamsFilter.propTypes = {
  leagueTeams: ImmutablePropTypes.list,
  teams: ImmutablePropTypes.list
}
