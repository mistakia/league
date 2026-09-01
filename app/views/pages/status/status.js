import React, { useEffect } from 'react'
import dayjs from 'dayjs'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'

import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemSecondaryAction from '@mui/material/ListItemSecondaryAction'
import ListItemText from '@mui/material/ListItemText'

import Accordion from '@components/accordion'
import Icon from '@components/icon'
import Loading from '@components/loading'
import { job_title_by_id } from '#libs-shared/job-constants.mjs'
import PageLayout from '@layouts/page'

import './status.styl'

const StatusItem = ({ status_item, index }) => {
  const [expanded, set_expanded] = React.useState(false)
  const is_operational = Boolean(status_item.is_successful)
  // The app's own status colours from general.styl rather than MUI's palette
  // module. `.icon` fills with currentColor, so a text colour class paints the
  // glyph.
  const icon = is_operational ? (
    <Icon name='check-circle-outline' className='text-green' />
  ) : (
    <Icon name='error' className='text-red' />
  )

  // jobs.run_at is timestamptz, so this arrives as an ISO string.
  const time = dayjs(status_item.run_at)
  const max_message_length = 150
  const message = status_item.reason || 'Operational'
  const truncated_message =
    message.length > max_message_length
      ? message.slice(0, max_message_length) + '...'
      : message
  const secondary = `${time.fromNow()} - ${truncated_message}`

  const handle_click = () => {
    set_expanded(!expanded)
  }

  return (
    <ListItemButton key={index} onClick={handle_click}>
      <ListItemText
        primary={job_title_by_id[status_item.type]}
        secondary={expanded ? message : secondary}
      />
      <ListItemSecondaryAction>{icon}</ListItemSecondaryAction>
    </ListItemButton>
  )
}

StatusItem.propTypes = {
  status_item: PropTypes.object.isRequired,
  index: PropTypes.number.isRequired
}

export default function StatusPage({ load, status }) {
  useEffect(() => {
    load()
  }, [load])

  if (status.get('is_loading')) {
    return <PageLayout body={<Loading loading />} scroll />
  }

  const success_items = []
  const error_items = []

  status.get('jobs').forEach((status_item, index) => {
    const item = (
      <StatusItem key={index} status_item={status_item} index={index} />
    )
    if (status_item.is_successful) {
      success_items.push(item)
    } else {
      error_items.push(item)
    }
  })

  return (
    <PageLayout
      body={
        <div className='league-container' style={{ marginTop: '64px' }}>
          {error_items.length > 0 && (
            <Accordion
              default_expanded
              className='status-error'
              icon_name='arrow-drop-down'
              summary={
                <div className='status-error-summary'>
                  <Icon name='warning' />
                  <div className='status-error-title'>
                    {error_items.length} Issues
                  </div>
                </div>
              }
            >
              <List>{error_items}</List>
            </Accordion>
          )}
          <Accordion
            icon_name='arrow-drop-down'
            summary={
              <div className='status-success-summary'>
                <Icon name='task-complete' />
                <div className='status-success-title'>
                  {success_items.length} Jobs Operational
                </div>
              </div>
            }
          >
            <List>{success_items}</List>
          </Accordion>
        </div>
      }
      scroll
    />
  )
}

StatusPage.propTypes = {
  load: PropTypes.func,
  status: ImmutablePropTypes.map
}
