import React from 'react'
import PropTypes from 'prop-types'

import Icon from '@components/icon'

import './player-header.styl'

export default class PlayerHeader extends React.Component {
  handleClick = () => {
    this.props.toggle(this.props.value)
  }

  render = () => {
    const { label, className, order, orderBy, value } = this.props
    const isSelected = orderBy === value
    const classNames = ['player__header']
    if (className) classNames.push(className)
    if (isSelected) {
      classNames.push('selected')
      classNames.push(order)
    }

    return (
      <div className={classNames.join(' ')} onClick={this.handleClick}>
        <Icon name='down' />
        {label}
      </div>
    )
  }
}

PlayerHeader.propTypes = {
  toggle: PropTypes.func,
  value: PropTypes.string,
  label: PropTypes.string,
  className: PropTypes.string,
  order: PropTypes.string,
  orderBy: PropTypes.string
}
