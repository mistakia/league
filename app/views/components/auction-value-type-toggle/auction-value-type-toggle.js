import React from 'react'

import Toggle from '@components/toggle'

export default class AuctionValueTypeToggle extends React.Component {
  handleChange = (event, value) => {
    this.props.setValueType(value)
  }

  render = () => {
    const { valueType } = this.props

    const values = [{
      value: '0',
      label: 'Season'
    }, {
      value: 'ros',
      label: 'ROS'
    }]

    return (
      <Toggle values={values} selected={valueType} onChange={this.handleChange} />
    )
  }
}
