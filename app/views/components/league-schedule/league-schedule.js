import React from 'react'
import PropTypes from 'prop-types'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import Popover from '@material-ui/core/Popover'

import LeagueScheduleList from '@components/league-schedule-list'

import './league-schedule.styl'

dayjs.extend(relativeTime)

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
    const next = events.length
      ? `${events[0].detail} ${dayjs().to(events[0].date)}`
      : null

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
          <LeagueScheduleList />
        </Popover>
      </div>
    )
  }
}

LeagueSchedule.propTypes = {
  events: PropTypes.array
}
