import React from 'react'

export default class NFLTeamBye extends React.Component {
  render = () => {
    const { bye } = this.props
    return (
      <span className='bye'>{bye}</span>
    )
  }
}
