import React from 'react'

import './auction-team.styl'

export default class AuctionTeam extends React.Component {
  render = () => {
    const { team, transactions } = this.props

    return (
      <div className='auction__team'>
        <div className='auction__team-name'>{team.name}</div>
        <div className='auction__team-cap'>{team.acap}</div>
      </div>
    )
  }
}
