import React from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'

import PlayerFilter from '@components/player-filter'
import { nfl_draft_rounds } from '@constants'

export default class PositionFilter extends React.Component {
  render() {
    const state = {
      type: 'nfl_draft_rounds',
      label: 'DRAFT ROUNDS',
      values: []
    }

    for (const round of nfl_draft_rounds) {
      state.values.push({
        label: round === 0 ? 'Undrafted' : round,
        value: round,
        selected: this.props.nfl_draft_rounds.includes(round)
      })
    }

    return <PlayerFilter {...state} />
  }
}

PositionFilter.propTypes = {
  nfl_draft_rounds: ImmutablePropTypes.list
}
