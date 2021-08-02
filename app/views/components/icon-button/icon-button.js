import React from 'react'
import PropTypes from 'prop-types'

import Button from '@components/button'
import Icon from '@components/icon'

export default class IconButton extends React.Component {
  render = () => {
    const { className, icon, type = 'button', ...props } = this.props

    const classNames = ['button__icon', `button__${icon}`, className]

    return (
      <Button className={classNames.join(' ')} type={type} {...props}>
        <Icon name={icon} />
      </Button>
    )
  }
}

IconButton.propTypes = {
  className: PropTypes.string,
  icon: PropTypes.string,
  type: PropTypes.string
}
