import React from 'react'
import PropTypes from 'prop-types'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import advancedFormat from 'dayjs/plugin/advancedFormat'
import Popover from '@material-ui/core/Popover'

import './league-schedule.styl'

dayjs.extend(relativeTime)
dayjs.extend(advancedFormat)

export default class LeagueSchedule extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      anchorEl: null
    }
  }

  handleClick = (event) => {
    this.setState({ anchorEl: event.target })
  }

  handleClose = () => {
    this.setState({ anchorEl: null })
  }

  render = () => {
    const { events } = this.props
    const open = Boolean(this.state.anchorEl)

    const items = []
    const next = events.length
      ? `${events[0].detail} ${dayjs().to(events[0].date)}`
      : null
    for (const [index, event] of events.entries()) {
      items.push(
        <div key={index} className='league__schedule-item'>
          <div className='league__schedule-item-body'>
            <strong>{event.detail}</strong> {dayjs().to(event.date)}
          </div>
          <div className='league__schedule-item-date'>
            {event.date.local().format('l LT z')}
          </div>
        </div>
      )
    }

    return (
      <div className='league__schedule'>
        <div className='league__schedule-anchor' onClick={this.handleClick}>
          {next}
        </div>
        <Popover
          open={open}
          anchorEl={this.state.anchorEl}
          onClose={this.handleClose}
          classes={{
            root: 'league__schedule-popover'
          }}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'center'
          }}
          transformOrigin={{
            vertical: 'top',
            horizontal: 'center'
          }}>
          {items}
        </Popover>
      </div>
    )
  }
}

LeagueSchedule.propTypes = {
  events: PropTypes.array
}
