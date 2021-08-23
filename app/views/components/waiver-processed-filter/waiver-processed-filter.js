import React from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'
import dayjs from 'dayjs'

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
      const label = dayjs.unix(date).format('ddd, MMM D h:mm YYYY')

      state.values.push({
        value: date,
        label,
        selected: this.props.processed.includes(date)
      })
    }

    return <WaiversFilter {...state} />
  }
}

WaiverTypeFilter.propTypes = {
  processingTimes: ImmutablePropTypes.list,
  processed: ImmutablePropTypes.list
}
