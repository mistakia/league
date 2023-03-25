import React, { useState } from 'react'
import PropTypes from 'prop-types'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import Collapse from '@mui/material/Collapse'
import ExpandLess from '@mui/icons-material/ExpandLess'
import ExpandMore from '@mui/icons-material/ExpandMore'

import LeagueScheduleList from '@components/league-schedule-list'

import './league-schedule.styl'

dayjs.extend(relativeTime)

export default function LeagueSchedule({ events }) {
  const [open, set_open] = useState(false)
  const have_events = Boolean(events.length)
  const next = have_events
    ? `${events[0].detail} ${dayjs().to(events[0].date)}`
    : 'No upcoming events'

  return (
    <div className='league__schedule'>
      <div className='league__schedule-anchor' onClick={() => set_open(!open)}>
        <div className='league__schedule-text'>{next}</div>
        {have_events && (open ? <ExpandLess /> : <ExpandMore />)}
      </div>
      {have_events && (
        <Collapse in={open} timeout='auto' unmountOnExit>
          <LeagueScheduleList />
        </Collapse>
      )}
    </div>
  )
}

LeagueSchedule.propTypes = {
  events: PropTypes.array
}
