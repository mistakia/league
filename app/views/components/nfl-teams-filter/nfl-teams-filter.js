import React from 'react'

import { constants } from '@common'
import PlayerFilter from '@components/player-filter'

export default class NFLTeamsFilter extends React.Component {
  render () {
    const state = {
      type: 'nflTeams',
      label: 'NFL TEAM',
      values: []
    }

    for (const team of constants.nflTeams) {
      state.values.push({
        label: team,
        value: team,
        selected: this.props.nflTeams.includes(team)
      })
    }

    return (
      <PlayerFilter {...state} />
    )
  }
}
