import React from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'

import { constants } from '@libs-shared'
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

    return <StatFilter {...state} />
  }
}

StatDownsFilter.propTypes = {
  downs: ImmutablePropTypes.list
}
