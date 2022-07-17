import React from 'react'
import PropTypes from 'prop-types'

import TeamName from '@components/team-name'
import Button from '@components/button'
import Timer from '@components/timer'
import AuctionNominatedPlayer from '@components/auction-nominated-player'

import './auction-main-bid.styl'

export default class AuctionMainBid extends React.Component {
  constructor(props) {
    super(props)

    this.state = {
      value: 0
    }
  }

  isValid = (value) => {
    if (value !== 0 && !value) {
      return false
    }

    if (!Number.isInteger(value)) {
      return false
    }

    if (value > this.props.availableSalarySpace) {
      return false
    }

    if (this.props.nominated_pid && value <= this.props.bidValue) {
      return false
    } else if (value < 0) {
      return false
    }

    return true
  }

  handleChange = (event) => {
    const value = event.target.value ? parseInt(event.target.value, 10) : ''
    if (value && !Number.isInteger(value)) {
      return
    }

    if (value && value > this.props.availableSalarySpace) {
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
    if (!this.isValid(this.state.value)) {
      this.props.showNotification({
        message: 'missing or invalid bid amount',
        severity: 'warning'
      })
      return
    }

    this.props.bid(this.state.value)
  }

  handleClickNominate = () => {
    if (!this.isValid(this.state.value)) {
      this.props.showNotification({
        message: 'missing or invalid bid amount',
        severity: 'warning'
      })
      return
    }

    this.props.nominate(this.state.value)
  }

  componentDidUpdate = ({ bidValue, selected, nominated_pid }, { value }) => {
    if (!nominated_pid && this.props.nominated_pid) {
      // new player nominated
      this.setState({ value: this.props.bidValue + 1 })
    } else if (!this.props.nominated_pid && nominated_pid) {
      // waiting on nomination
      this.setState({ value: 0 })
    } else if (this.props.bidValue > bidValue) {
      // received new bid
      this.setState({ value: this.props.bidValue + 1 })
    }
  }

  render = () => {
    const {
      isPaused,
      isComplete,
      isLocked,
      isEligible,
      exceedsSalarySpace,
      nominated_pid,
      isNominating,
      selected,
      isCommish,
      nominatingTeamId,
      timer,
      isWinningBid,
      league,
      isStarted,
      adate
    } = this.props

    let action = null
    if (!league.adate || !isStarted || isComplete) {
      action = null
    } else if (isPaused) {
      action = (
        <Button disabled text>
          Paused
        </Button>
      )
    } else if (isLocked) {
      action = (
        <Button disabled text>
          Locked
        </Button>
      )
    } else if (nominated_pid) {
      if (isWinningBid) {
        action = <Button disabled>Winning Bid</Button>
      } else if (exceedsSalarySpace) {
        action = (
          <Button disabled text>
            Exceeded CAP
          </Button>
        )
      } else if (!isEligible) {
        action = (
          <Button disabled text>
            Ineligible
          </Button>
        )
      } else {
        action = (
          <Button onClick={this.handleClickBid}>Bid ${this.state.value}</Button>
        )
      }
    } else if (isNominating || isCommish) {
      action = (
        <Button disabled={!selected} onClick={this.handleClickNominate}>
          Nominate ${this.state.value}
        </Button>
      )
    } else {
      action = (
        <Button disabled text>
          Waiting
        </Button>
      )
    }

    let main
    if (!league.adate) {
      main = <div>Auction is not scheduled.</div>
    } else if (isComplete) {
      main = <div>Auction is complete.</div>
    } else if (!isStarted) {
      main = (
        <div>
          Auction will begin on {adate.format('dddd, MMMM D YYYY, h:mm:ss a')}
        </div>
      )
    } else if (isPaused) {
      main = <div>Auction is paused.</div>
    } else if (nominated_pid) {
      main = <AuctionNominatedPlayer pid={nominated_pid} />
    } else if (selected) {
      main = <AuctionNominatedPlayer pid={selected} />
    } else if (isNominating) {
      main = <div>Your turn to nominate a player</div>
    } else if (isCommish) {
      main = <div>Nomination timer expired, make a nomination</div>
    } else {
      main = (
        <div>
          Waiting for a player to be nominated by{' '}
          <TeamName tid={nominatingTeamId} />
        </div>
      )
    }

    return (
      <div className='auction__main-bid'>
        {isStarted && !isComplete && (
          <div className='auction__main-timer'>
            <Timer
              expiration={timer}
              alert={isNominating || Boolean(nominated_pid)}
            />
          </div>
        )}
        <div className='auction__main-body'>{main}</div>
        <div className='auction__main-action'>{action}</div>
        {isStarted && !isComplete && (
          <div className='auction__main-input'>
            <div
              className='auction__main-input-up'
              onClick={this.handleUpClick}
            >
              +
            </div>
            <div
              className='auction__main-input-down'
              onClick={this.handleDownClick}
            >
              —
            </div>
            <label>Enter Bid</label>
            <input
              type='number'
              value={this.state.value}
              onChange={this.handleChange}
            />
          </div>
        )}
      </div>
    )
  }
}

AuctionMainBid.propTypes = {
  bid: PropTypes.func,
  availableSalarySpace: PropTypes.number,
  nominated_pid: PropTypes.string,
  bidValue: PropTypes.number,
  showNotification: PropTypes.func,
  nominate: PropTypes.func,
  selected: PropTypes.string,
  isPaused: PropTypes.bool,
  isComplete: PropTypes.bool,
  isLocked: PropTypes.bool,
  isEligible: PropTypes.bool,
  exceedsSalarySpace: PropTypes.bool,
  isNominating: PropTypes.bool,
  isCommish: PropTypes.bool,
  nominatingTeamId: PropTypes.number,
  timer: PropTypes.number,
  isWinningBid: PropTypes.bool,
  league: PropTypes.object,
  isStarted: PropTypes.bool,
  adate: PropTypes.object
}
