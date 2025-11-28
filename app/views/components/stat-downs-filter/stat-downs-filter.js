import React from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'

import StatFilter from '@components/stat-filter'
import { nfl_downs } from '@constants'

export default class StatDownsFilter extends React.Component {
  render = () => {
    const state = {
      type: 'downs',
      label: 'DOWNS',
      values: []
    }

    for (const down of nfl_downs) {
      state.values.push({
        label: down,
        value: down,
        selected: this.props.downs.includes(down)
      })
    }

    return <StatFilter {...state} />
  }
}

StatDownsFilter.propTypes = {
  downs: ImmutablePropTypes.list
}
