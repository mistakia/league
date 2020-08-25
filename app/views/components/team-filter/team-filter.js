import React from 'react'

import PlayerFilter from '@components/player-filter'

export default class TeamFilter extends React.Component {
  render () {
    const state = {
      type: 'teamIds',
      label: 'TEAMS',
      values: []
    }

    for (const team of this.props.teams.values()) {
      state.values.push({
        label: team.name,
        value: team.uid,
        selected: this.props.teamIds.includes(team.uid)
      })
    }

    return (
      <PlayerFilter {...state} />
    )
  }
}
