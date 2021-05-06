import React from 'react'

import { constants } from '@common'
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
