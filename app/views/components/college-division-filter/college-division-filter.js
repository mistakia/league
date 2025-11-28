import React from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'

import PlayerFilter from '@components/player-filter'
import { ncaa_conference_names } from '@constants'

export default class CollegeDivisionFilter extends React.Component {
  render() {
    const state = {
      type: 'collegeDivisions',
      label: 'COLLEGE DIVS',
      values: []
    }

    for (const division of ncaa_conference_names) {
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
