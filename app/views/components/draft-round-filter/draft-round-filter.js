import React from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'

import { constants } from '@libs-shared'
import PlayerFilter from '@components/player-filter'

export default class PositionFilter extends React.Component {
  render() {
    const state = {
      type: 'nfl_draft_rounds',
      label: 'DRAFT ROUNDS',
      values: []
    }

    for (const round of constants.nfl_draft_rounds) {
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
