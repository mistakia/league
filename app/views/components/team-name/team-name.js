import React from 'react'

import './team-name.styl'

export default class TeamName extends React.Component {
  render = () => {
    const { team, abbrv } = this.props

    return (
      <div className='team__name'>
        {abbrv ? team.abbrv : team.name}
      </div>
    )
  }
}
