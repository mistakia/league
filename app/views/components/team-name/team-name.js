import React from 'react'

export default class TeamName extends React.Component {
  render = () => {
    const { team } = this.props

    return (
      <div className='team__name'>
        {team.name}
      </div>
    )
  }
}
