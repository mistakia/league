import React from 'react'

import Button from '@components/button'

import './logout.styl'

export default class Logout extends React.Component {
  render () {
    const { logout } = this.props

    return (
      <div id='logout'>
        <Button className='button__text' onClick={logout}>Logout</Button>
      </div>
    )
  }
}
