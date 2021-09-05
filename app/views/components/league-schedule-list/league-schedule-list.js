import React from 'react'
import PropTypes from 'prop-types'
import dayjs from 'dayjs'
import List from '@material-ui/core/List'
import ListItem from '@material-ui/core/ListItem'
import ListItemText from '@material-ui/core/ListItemText'
import relativeTime from 'dayjs/plugin/relativeTime'
import advancedFormat from 'dayjs/plugin/advancedFormat'

dayjs.extend(relativeTime)
dayjs.extend(advancedFormat)

import './league-schedule-list.styl'

export default class LeagueScheduleList extends React.Component {
  render() {
    const { events } = this.props
    const items = []
    for (const [index, event] of events.entries()) {
      items.push(
        <ListItem key={index} className='league__schedule-item'>
          <ListItemText
            primary={
              <>
                <strong>{event.detail}</strong> {dayjs().to(event.date)}
              </>
            }
            secondary={event.date.local().format('l LT z')}
          />
        </ListItem>
      )
    }

    return <List>{items}</List>
  }
}

LeagueScheduleList.propTypes = {
  events: PropTypes.array
}
