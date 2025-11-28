import React from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'

import ScheduleFilter from '@components/schedule-filter'
import { regular_fantasy_weeks } from '@constants'

export default class ScheduleWeeksFilter extends React.Component {
  render = () => {
    const state = {
      type: 'weeks',
      label: 'WEEKS',
      values: []
    }

    for (const week of regular_fantasy_weeks) {
      state.values.push({
        value: week,
        label: week,
        selected: this.props.weeks.includes(week)
      })
    }

    return <ScheduleFilter {...state} />
  }
}

ScheduleWeeksFilter.propTypes = {
  weeks: ImmutablePropTypes.list
}
