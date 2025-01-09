import React, { useEffect } from 'react'
import dayjs from 'dayjs'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'

import { green, red } from '@mui/material/colors'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemSecondaryAction from '@mui/material/ListItemSecondaryAction'
import ListItemText from '@mui/material/ListItemText'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import ErrorIcon from '@mui/icons-material/Error'
import Accordion from '@mui/material/Accordion'
import AccordionDetails from '@mui/material/AccordionDetails'
import AccordionSummary from '@mui/material/AccordionSummary'
import WarningIcon from '@mui/icons-material/Warning'
import TaskAltIcon from '@mui/icons-material/TaskAlt'
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown'

import Loading from '@components/loading'
import { job_title_by_id } from '@libs-shared/job-constants'
import PageLayout from '@layouts/page'

import './status.styl'

const StatusItem = ({ status_item, index }) => {
  const [expanded, set_expanded] = React.useState(false)
  const is_operational = Boolean(status_item.succ)
  const icon = is_operational ? (
    <CheckCircleOutlineIcon style={{ color: green[500] }} />
  ) : (
    <ErrorIcon style={{ color: red[500] }} />
  )

  const time = dayjs.unix(status_item.timestamp)
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
    if (status_item.succ) {
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
            <Accordion defaultExpanded>
              <AccordionSummary
                expandIcon={<ArrowDropDownIcon />}
                className='status-error'
              >
                <div className='status-error-summary'>
                  <WarningIcon />
                  <div className='status-error-title'>
                    {error_items.length} Issues
                  </div>
                </div>
              </AccordionSummary>
              <AccordionDetails>
                <List>{error_items}</List>
              </AccordionDetails>
            </Accordion>
          )}
          <Accordion>
            <AccordionSummary expandIcon={<ArrowDropDownIcon />}>
              <div className='status-success-summary'>
                <TaskAltIcon />
                <div className='status-success-title'>
                  {success_items.length} Jobs Operational
                </div>
              </div>
            </AccordionSummary>
            <AccordionDetails>
              <List>{success_items}</List>
            </AccordionDetails>
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
