import React from 'react'

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
      this.setState({ seconds: 0 })
    } else if (seconds < 5) {
      this.setState({ seconds, warning: true })
      beep()
    } else {
      this.setState({ seconds, warning: false })
    }
  }

  componentDidUpdate = () => {
    const now = Math.round(Date.now() / 1000)
    const seconds = this.props.expiration - now

    if (!this.interval && seconds > 0) {
      this.interval = setInterval(this.tick, 1000)
    }
  }

  componentDidMount = () => {
    this.interval = setInterval(this.tick, 1000)
  }

  render = () => {
    const classNames = ['timer']
    if (this.state.warning) classNames.push('warning')
    return (
      <div className={classNames.join(' ')}>
        <div className='timer__flash' />
        <div className='timer__time'>
          {('0' + this.state.seconds).slice(-2)}
        </div>
      </div>
    )
  }
}
