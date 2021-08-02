import React from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'

import PlayerFilter from '@components/player-filter'

export default class AgeFilter extends React.Component {
  render() {
    const state = {
      type: 'age',
      label: 'AGE',
      values: []
    }

    for (const age of this.props.allAges) {
      state.values.push({
        label: age,
        value: age,
        selected: this.props.age.includes(age)
      })
    }

    return <PlayerFilter {...state} />
  }
}

AgeFilter.propTypes = {
  age: ImmutablePropTypes.list,
  allAges: ImmutablePropTypes.allAges
}
