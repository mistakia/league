import React from 'react'

export default class Timer extends React.Component {
  constructor (props) {
    super (props)
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
    } else {
      this.setState({ seconds })
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
    return (
      <div className='timer'>
        {('0' + this.state.seconds).slice (-2)}
      </div>
    )
  }
}
