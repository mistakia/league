import React from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'

import PlayerFilter from '@components/player-filter'

import './highlight-team.styl'

export default class HighlightTeam extends React.Component {
  render() {
    const state = {
      type: 'highlight_teamIds',
      label: 'HIGHLIGHT TEAMS',
      values: []
    }

    for (const team of this.props.teams.values()) {
      state.values.push({
        className: `draft-order-${team.draft_order}`,
        label: team.name,
        value: team.uid,
        selected: this.props.highlight_teamIds.includes(team.uid)
      })
    }

    return <PlayerFilter {...state} />
  }
}

HighlightTeam.propTypes = {
  highlight_teamIds: ImmutablePropTypes.list,
  teams: ImmutablePropTypes.map
}
