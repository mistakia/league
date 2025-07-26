import React from 'react'
import PropTypes from 'prop-types'

import TeamName from '@components/team-name'
import Button from '@mui/material/Button'
import LoadingButton from '@mui/lab/LoadingButton'
import ButtonGroup from '@mui/material/ButtonGroup'
import AddIcon from '@mui/icons-material/Add'
import RemoveIcon from '@mui/icons-material/Remove'
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

    if (value > this.props.availableCap) {
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
    const value = event.target.value ? Number(event.target.value) : ''
    if (value && !Number.isInteger(value)) {
      return
    }

    if (value && value > this.props.availableCap) {
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

  componentDidUpdate = ({ bidValue, nominated_pid }, { value }) => {
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
      isAboveCap,
      nominated_pid,
      isNominating,
      selected_pid,
      isCommish,
      nominatingTeamId,
      timer,
      isWinningBid,
      league,
      isStarted,
      free_agency_live_auction_start
    } = this.props

    const classNames = []
    let action = null
    let disabled = false
    if (!league.free_agency_live_auction_start || !isStarted || isComplete) {
      action = null
    } else if (isPaused) {
      action = null
    } else if (isLocked) {
      disabled = true
      action = (
        <Button disabled variant='contained'>
          Locked
        </Button>
      )
    } else if (nominated_pid) {
      if (isWinningBid) {
        disabled = true
        classNames.push('winning')
        action = <Button disabled>Winning Bid</Button>
      } else if (isAboveCap) {
        disabled = true
        action = (
          <Button disabled variant='contained'>
            Exceeded CAP
          </Button>
        )
      } else if (!isEligible) {
        disabled = true
        action = (
          <Button disabled variant='contained'>
            Ineligible
          </Button>
        )
      } else {
        action = (
          <Button onClick={this.handleClickBid}>Bid ${this.state.value}</Button>
        )
      }
    } else if (isNominating || isCommish) {
      disabled = !selected_pid
      action = (
        <Button
          variant='contained'
          disabled={!selected_pid}
          onClick={this.handleClickNominate}
        >
          Nominate ${this.state.value}
        </Button>
      )
    } else {
      disabled = true
      action = <LoadingButton disabled variant='contained' loading />
    }

    let main
    if (!league.free_agency_live_auction_start) {
      main = <div className='auction__text'>Auction is not scheduled</div>
    } else if (isComplete) {
      main = <div className='auction__text'>Auction is complete</div>
    } else if (!isStarted) {
      main = (
        <div className='auction__text'>
          Auction will begin on{' '}
          {free_agency_live_auction_start.format('dddd, MMMM D YYYY, ha')}
        </div>
      )
    } else if (isPaused) {
      main = <div className='auction__text'>Auction is paused</div>
    } else if (nominated_pid) {
      main = <AuctionNominatedPlayer pid={nominated_pid} />
    } else if (selected_pid) {
      main = <AuctionNominatedPlayer pid={selected_pid} />
    } else if (isNominating) {
      main = <div className='auction__text'>Your turn to nominate a player</div>
    } else {
      main = (
        <div className='auction__text'>
          Waiting for a nomination by <TeamName tid={nominatingTeamId} abbrv />
        </div>
      )
    }

    return (
      <div className='auction__bar'>
        <div className='auction__bar-body'>
          <div className='auction__bid-info'>{main}</div>
          {isStarted && !isComplete && !isPaused && (
            <div className='auction__bid-actions'>
              <div className='auction__main-timer'>
                <Timer
                  expiration={timer}
                  alert={isNominating || Boolean(nominated_pid)}
                />
              </div>
              <div className='auction__main-action'>
                <ButtonGroup
                  className={classNames.join(' ')}
                  variant='contained'
                  disabled={disabled}
                  size='small'
                >
                  {(!nominated_pid || !isWinningBid) && (
                    <Button onClick={this.handleDownClick}>
                      <RemoveIcon />
                    </Button>
                  )}
                  {action}
                  {(!nominated_pid || !isWinningBid) && (
                    <Button onClick={this.handleUpClick}>
                      <AddIcon />
                    </Button>
                  )}
                </ButtonGroup>
              </div>
              <div className='auction__main-input'>
                <label>Enter Bid</label>
                <input
                  type='number'
                  value={this.state.value}
                  onChange={this.handleChange}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }
}

AuctionMainBid.propTypes = {
  bid: PropTypes.func,
  availableCap: PropTypes.number,
  nominated_pid: PropTypes.string,
  bidValue: PropTypes.number,
  showNotification: PropTypes.func,
  nominate: PropTypes.func,
  selected_pid: PropTypes.string,
  isPaused: PropTypes.bool,
  isComplete: PropTypes.bool,
  isLocked: PropTypes.bool,
  isEligible: PropTypes.bool,
  isAboveCap: PropTypes.bool,
  isNominating: PropTypes.bool,
  isCommish: PropTypes.bool,
  nominatingTeamId: PropTypes.number,
  timer: PropTypes.number,
  isWinningBid: PropTypes.bool,
  league: PropTypes.object,
  isStarted: PropTypes.bool,
  free_agency_live_auction_start: PropTypes.object
}
