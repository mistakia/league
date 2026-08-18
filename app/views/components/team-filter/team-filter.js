import React from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'

import PlayerFilter from '@components/player-filter'

export default class TeamFilter extends React.Component {
  render() {
    const state = {
      type: 'teamIds',
      label: 'FILTER TEAMS',
      values: []
    }

    for (const team of this.props.teams.values()) {
      state.values.push({
        label: team.name,
        value: team.team_id,
        selected: this.props.teamIds.includes(team.team_id)
      })
    }

    return <PlayerFilter {...state} />
  }
}

TeamFilter.propTypes = {
  teamIds: ImmutablePropTypes.list,
  teams: ImmutablePropTypes.map
}
