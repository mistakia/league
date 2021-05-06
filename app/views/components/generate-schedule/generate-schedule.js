import React from 'react'

import Button from '@components/button'

export default class GenerateSchedule extends React.Component {
  handleClick = () => {
    this.props.generate(this.props.leagueId)
  }

  render = () => {
    return <Button onClick={this.handleClick}>Generate Schedule</Button>
  }
}
