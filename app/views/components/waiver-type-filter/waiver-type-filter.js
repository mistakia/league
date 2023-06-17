import React from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'

import { constants } from '@libs-shared'
import WaiversFilter from '@components/waivers-filter'

export default class WaiverTypeFilter extends React.Component {
  render = () => {
    const state = {
      single: true,
      type: 'type',
      label: 'TYPE',
      values: []
    }

    for (const type in constants.waivers) {
      const value = constants.waivers[type]
      const label = constants.waiversDetail[value]

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
