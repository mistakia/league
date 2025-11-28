import React from 'react'
import PropTypes from 'prop-types'

import { current_season } from '@constants'
import PlayerFilter from '@components/player-filter'

export default class WeekFilter extends React.Component {
  render() {
    const state = {
      single: true,
      type: 'week',
      label: 'WEEK',
      values: []
    }

    for (
      let week = Math.max(current_season.week, 1);
      week <= current_season.finalWeek;
      week++
    ) {
      state.values.push({
        label: week,
        value: week,
        selected: this.props.week.includes(week)
      })
    }

    return <PlayerFilter {...state} />
  }
}

WeekFilter.propTypes = {
  week: PropTypes.array
}
