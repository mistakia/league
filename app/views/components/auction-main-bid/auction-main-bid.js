import React from 'react'
import moment from 'moment'

import PlayerName from '@components/player-name'
import TeamName from '@components/team-name'
import Button from '@components/button'
import Timer from '@components/timer'

import './auction-main-bid.styl'

export default class AuctionMainBid extends React.Component {
  constructor (props) {
    super(props)

    this.state = {
      value: 0
    }
  }

  isValid = (value) => {
    if (value > this.props.availableCap) {
      return false
    }

    if (this.props.playerId && value <= this.props.bidValue) {
      return false
    } else if (value < 0) {
      return false
    }

    return true
  }

  handleChange = (event) => {
    const value = parseInt(event.target.value, 10)
    if (!Number.isInteger(value)) {
      return
    }

    if (!this.isValid(value)) {
      return
    }
    this.setState({ value })
  }

  handleUpClick = () => {
    const value = this.state.value + 1
    if (!this.isValid(value)) {
      return
    }
    this.setState({ value })
  }

  handleDownClick = () => {
    const value = this.state.value - 1
    if (!this.isValid(value)) {
      return
    }
    this.setState({ value })
  }

  handleClickBid = () => {
    this.props.bid(this.state.value)
  }

  handleClickNominate = () => {
    this.props.nominate(this.state.value)
  }

  static getDerivedStateFromProps ({ bidValue, selected, playerId }, { value }) {
    if (!playerId && !selected) {
      return { value: 0 }
    }

    if (playerId && bidValue >= value) {
      return { value: bidValue + 1 }
    }

    return null
  }

  render = () => {
    const {
      isPaused,
      isLocked,
      isEligible,
      isAboveCap,
      playerId,
      isNominating,
      selected,
      isCommish,
      nominatingTeamId,
      timer,
      isWinningBid,
      auctionStart
    } = this.props

    const now = moment()
    const start = moment(auctionStart, 'X')
    const isStarted = start.isBefore(now)

    let action
    if (!auctionStart || !isStarted) {
      action = null
    } else if (isPaused) {
      action = (<Button disabled>Paused</Button>)
    } else if (isLocked) {
      action = (<Button disabled>Locked</Button>)
    } else if (playerId) {
      if (isWinningBid) {
        action = (<Button disabled>Winning Bid</Button>)
      } else if (isAboveCap) {
        action = (<Button disabled>Exceeded CAP</Button>)
      } else if (!isEligible) {
        action = (<Button disabled>Ineligible</Button>)
      } else {
        action = (<Button onClick={this.handleClickBid}>Bid ${this.state.value}</Button>)
      }
    } else if (isNominating || isCommish) {
      action = (<Button disabled={!selected} onClick={this.handleClickNominate}>Nominate ${this.state.value}</Button>)
    } else {
      action = (<Button disabled>Waiting</Button>)
    }

    let main
    if (!auctionStart) {
      main = (<div>Auction is not scheduled.</div>)
    } else if (!isStarted) {
      main = (<div>Auction will begin on {start.format('dddd, MMMM Do YYYY, h:mm:ss a')}</div>)
    } else if (isPaused) {
      main = (<div>Auction is paused.</div>)
    } else if (playerId) {
      main = (<PlayerName playerId={playerId} />)
    } else if (selected) {
      main = (<PlayerName playerId={selected} />)
    } else if (isNominating) {
      main = (<div>Your turn to nominate a player</div>)
    } else if (isCommish) {
      main = (<div>Nomination timer expired, make a nomination</div>)
    } else {
      main = (<div>Waiting for a player to be nominated by <TeamName tid={nominatingTeamId} /></div>)
    }

    return (
      <div className='auction__main-bid'>
        {isStarted &&
          <div className='auction__main-timer'>
            <Timer expiration={timer} />
          </div>}
        <div className='auction__main-picture' />
        <div className='auction__main-player'>
          {main}
        </div>
        <div className='auction__main-action'>
          {action}
        </div>
        {isStarted &&
          <div className='auction__main-input'>
            <div className='auction__main-input-up' onClick={this.handleUpClick}>+</div>
            <div className='auction__main-input-down' onClick={this.handleDownClick}>—</div>
          </div>}
      </div>
    )
  }
}
