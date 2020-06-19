import React from 'react'

import PlayerName from '@components/player-name'
import TeamName from '@components/team-name'
import Button from '@components/button'

import './auction-main-bid.styl'

export default class AuctionMainBid extends React.Component {
  handleClickBid = () => {
    const value = (this.props.bidValue || 0) + 1
    this.props.bid(value)
  }

  handleClickNominate = () => {
    const value = this.props.bidValue
    this.props.nominate(value)
  }

  render = () => {
    const { isPaused, player, bidValue, isNominating, selected, nominatingTeamId } = this.props

    let action
    if (isPaused) {
      action = (<Button disabled>Paused</Button>)
    } else if (player) {
      action = (<Button onClick={this.handleClickBid}>Bid</Button>)
    } else if (isNominating) {
      action = (<Button disabled={!selected} onClick={this.handleClickNominate}>Nominate</Button>)
    } else {
      action = (<Button disabled>Waiting</Button>)
    }

    let main
    if (player) {
      main = (<PlayerName playerId={player} />)
    } else if (selected) {
      main = (<PlayerName playerId={selected} />)
    } else if (isNominating) {
      main = (<div>Your turn to nominate a player</div>)
    } else {
      main = (<div>Waiting for a player to be nominated by <TeamName tid={nominatingTeamId} /></div>)
    }

    return (
      <div className='auction__main-bid'>
        <div className='auction__main-picture' />
        <div className='auction__main-player'>
          {main}
        </div>
        <div className='auction__main-action'>
          {action}
        </div>
      </div>
    )
  }
}
