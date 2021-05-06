import React from 'react'
import moment from 'moment'

import WaiversFilter from '@components/waivers-filter'

export default class WaiverTypeFilter extends React.Component {
  render = () => {
    const { processingTimes } = this.props

    const state = {
      single: true,
      type: 'processed',
      label: 'DATE',
      values: []
    }

    for (const date of processingTimes.valueSeq()) {
      const label = moment(date, 'X').format('ddd, MMM Do h:mm YYYY')

      state.values.push({
        value: date,
        label,
        selected: this.props.processed.includes(date)
      })
    }

    return <WaiversFilter {...state} />
  }
}
