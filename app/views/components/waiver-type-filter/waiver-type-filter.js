import React from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'

import WaiversFilter from '@components/waivers-filter'
import { waiver_types, waiver_type_display_names } from '@constants'

export default class WaiverTypeFilter extends React.Component {
  render = () => {
    const state = {
      single: true,
      type: 'type',
      label: 'TYPE',
      values: []
    }

    for (const type in waiver_types) {
      const value = waiver_types[type]
      const label = waiver_type_display_names[value]

      state.values.push({
        value,
        label,
        selected: this.props.type.includes(value)
      })
    }

    return <WaiversFilter {...state} />
  }
}

WaiverTypeFilter.propTypes = {
  type: ImmutablePropTypes.list
}
