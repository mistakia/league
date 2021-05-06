import React from 'react'

import { constants } from '@common'
import ScheduleFilter from '@components/schedule-filter'

export default class ScheduleWeeksFilter extends React.Component {
  render = () => {
    const state = {
      type: 'weeks',
      label: 'WEEKS',
      values: []
    }

    for (const week of constants.weeks) {
      state.values.push({
        value: week,
        label: week,
        selected: this.props.weeks.includes(week)
      })
    }

    return <ScheduleFilter {...state} />
  }
}
