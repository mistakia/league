import React from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'

import PlayerFilter from '@components/player-filter'
import { nfl_team_abbreviations } from '@constants'

export default class NFLTeamsFilter extends React.Component {
  render() {
    const state = {
      type: 'nflTeams',
      label: 'NFL TEAM',
      values: []
    }

    for (const team of nfl_team_abbreviations) {
      state.values.push({
        label: team,
        value: team,
        selected: this.props.nflTeams.includes(team)
      })
    }

    return <PlayerFilter {...state} />
  }
}

NFLTeamsFilter.propTypes = {
  nflTeams: ImmutablePropTypes.list
}
