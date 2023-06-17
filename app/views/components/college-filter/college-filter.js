import React from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'

import { constants } from '@libs-shared'
import PlayerFilter from '@components/player-filter'

export default class CollegeFilter extends React.Component {
  render() {
    const state = {
      type: 'colleges',
      label: 'COLLEGE',
      values: []
    }

    for (const college of constants.colleges) {
      state.values.push({
        label: college,
        value: college,
        selected: this.props.colleges.includes(college)
      })
    }

    return <PlayerFilter {...state} />
  }
}

CollegeFilter.propTypes = {
  colleges: ImmutablePropTypes.list
}
