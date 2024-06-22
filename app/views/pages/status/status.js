import React, { useEffect } from 'react'
import dayjs from 'dayjs'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'

import { green, red } from '@mui/material/colors'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
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
import { constants } from '@libs-shared'
import PageLayout from '@layouts/page'

import './status.styl'

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
    const is_operational = Boolean(status_item.succ)
    const icon = is_operational ? (
      <CheckCircleOutlineIcon style={{ color: green[500] }} />
    ) : (
      <ErrorIcon style={{ color: red[500] }} />
    )

    const time = dayjs.unix(status_item.timestamp)
    const secondary =
      `${time.fromNow()} - ` + (status_item.reason || 'Operational')

    const list_item = (
      <ListItem key={index}>
        <ListItemText
          primary={constants.jobDetails[status_item.type]}
          secondary={secondary}
        />
        <ListItemSecondaryAction>{icon}</ListItemSecondaryAction>
      </ListItem>
    )

    if (is_operational) {
      success_items.push(list_item)
    } else {
      error_items.push(list_item)
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
