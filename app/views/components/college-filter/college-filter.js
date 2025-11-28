import React from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'

import PlayerFilter from '@components/player-filter'
import { ncaa_college_names } from '@constants'

export default class CollegeFilter extends React.Component {
  render() {
    const state = {
      type: 'colleges',
      label: 'COLLEGE',
      values: []
    }

    for (const college of ncaa_college_names) {
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
