import React from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'
import dayjs from 'dayjs'

import WaiversFilter from '@components/waivers-filter'

export default function WaiverTypeFilter({ processing_times, processed }) {
  const state = {
    single: true,
    type: 'processed',
    label: 'DATE',
    values: []
  }

  const unique_dates = new Set(processing_times.valueSeq())

  for (const date of unique_dates) {
    // `waivers.processed` is timestamptz, so this is an ISO string rather than
    // epoch seconds and `dayjs.unix()` of one is Invalid Date -- every option in
    // the processed-date filter would have rendered as "Invalid Date".
    const label = dayjs(date).format('ddd, MMM D h:mm YYYY')

    state.values.push({
      value: date,
      label,
      selected: processed.includes(date)
    })
  }

  return <WaiversFilter {...state} />
}

WaiverTypeFilter.propTypes = {
  processing_times: ImmutablePropTypes.list,
  processed: ImmutablePropTypes.list
}
