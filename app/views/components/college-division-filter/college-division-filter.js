import React from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'

import { constants } from '@libs-shared'
import PlayerFilter from '@components/player-filter'

export default class CollegeDivisionFilter extends React.Component {
  render() {
    const state = {
      type: 'collegeDivisions',
      label: 'COLLEGE DIVS',
      values: []
    }

    for (const division of constants.collegeDivisions) {
      state.values.push({
        label: division,
        value: division,
        selected: this.props.collegeDivisions.includes(division)
      })
    }

    return <PlayerFilter {...state} />
  }
}

CollegeDivisionFilter.propTypes = {
  collegeDivisions: ImmutablePropTypes.list
}
