import React from 'react'
import PropTypes from 'prop-types'

import { beep } from '@core/audio'
import './timer.styl'

export default class Timer extends React.Component {
  constructor(props) {
    super(props)
    this.interval = null
    this.state = {
      seconds: 0
    }
  }

  tick = () => {
    const now = Math.round(Date.now() / 1000)
    const seconds = this.props.expiration - now

    if (seconds < 0) {
      clearInterval(this.interval)
      this.interval = null
      this.setState({ seconds: 0, alertFired: false })
    } else if (seconds < 5) {
      if (!this.state.alertFired && this.props.alert) {
        beep()
      }
      this.setState({ seconds, warning: true, alertFired: true })
    } else {
      this.setState({ seconds, warning: false })
    }
  }

  componentDidUpdate = () => {
    const now = Math.round(Date.now() / 1000)
    const seconds = this.props.expiration - now

    if (!this.interval && seconds > 0) {
      this.interval = setInterval(this.tick, 500)
    }
  }

  componentDidMount = () => {
    this.interval = setInterval(this.tick, 500)
  }

  render = () => {
    const classNames = ['timer']
    if (this.state.warning) classNames.push('warning')
    return (
      <div className={classNames.join(' ')}>
        <div className='timer__flash' />
        <div className='timer__time metric'>
          {('0' + this.state.seconds).slice(-2)}
        </div>
      </div>
    )
  }
}

Timer.propTypes = {
  expiration: PropTypes.number,
  alert: PropTypes.bool
}
