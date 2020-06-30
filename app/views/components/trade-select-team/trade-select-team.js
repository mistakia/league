import React from 'react'

import Icon from '@components/icon'

import './trade-select-team.styl'

export default class TradeSelectTeam extends React.Component {
  constructor (props) {
    super(props)
    this.state = {
      visible: false
    }
  }

  handleToggleClick = (event) => {
    if (this.state.visible) {
      const wasOutsideBody = this.body ? !this.body.contains(event.target) : false
      if (wasOutsideBody) {
        document.removeEventListener('click', this.handleToggleClick)
        return this.setState({ visible: false })
      }
    } else {
      document.addEventListener('click', this.handleToggleClick)
      this.setState({ visible: true })
    }
  }

  handleSelectClick = (event, teamId) => {
    event.preventDefault()
    event.stopPropagation()

    this.props.select(teamId)
    this.setState({ visible: false })
    document.removeEventListener('click', this.handleToggleClick)
  }

  render = () => {
    const { teams, team } = this.props
    const { visible } = this.state

    const items = teams.filter(t => t.uid !== team.uid).map((t, index) => {
      return (
        <div
          className='trade__select-team-body-item'
          key={index}
          onClick={(e) => this.handleSelectClick(e, t.uid)}
        >
          {t.name}
        </div>
      )
    })

    return (
      <div
        ref={ref => { this.root = ref }}
        className='trade__select-team'
        onClick={this.handleToggleClick}
      >
        <Icon name='arrow-down' />
        {visible &&
          <div ref={ref => { this.body = ref }} className='trade__select-team-body'>
            {items}
          </div>}
      </div>
    )
  }
}
