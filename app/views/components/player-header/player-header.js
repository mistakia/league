import React from 'react'

import Icon from '@components/icon'

import './player-header.styl'

export default class PlayerHeader extends React.Component {
  constructor (props) {
    super(props)

    this.click = this.click.bind(this)
  }

  click () {
    this.props.toggle(this.props.value)
  }

  render () {
    const { label, className, order, orderBy, value } = this.props
    const isSelected = orderBy === value
    const classNames = ['player__header']
    if (className) classNames.push(className)
    if (isSelected) {
      classNames.push('selected')
      classNames.push(order)
    }

    return (
      <div className={classNames.join(' ')} onClick={this.click}>
        <Icon name='down' />
        {label}
      </div>
    )
  }
}
