import React from 'react'

import { constants } from '@common'
import StatFilter from '@components/stat-filter'

export default class StatDownsFilter extends React.Component {
  render = () => {
    const state = {
      type: 'downs',
      label: 'DOWNS',
      values: []
    }

    for (const down of constants.downs) {
      state.values.push({
        label: down,
        value: down,
        selected: this.props.downs.includes(down)
      })
    }

    return (
      <StatFilter {...state} />
    )
  }
}
