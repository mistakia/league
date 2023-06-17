import React from 'react'
import dayjs from 'dayjs'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'

import Paper from '@mui/material/Paper'
import Container from '@mui/material/Container'
import { green, red } from '@mui/material/colors'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemSecondaryAction from '@mui/material/ListItemSecondaryAction'
import ListItemText from '@mui/material/ListItemText'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import ErrorIcon from '@mui/icons-material/Error'

import { constants } from '@libs-shared'
import PageLayout from '@layouts/page'

export default class StatusPage extends React.Component {
  componentDidMount = () => {
    this.props.load()
  }

  render = () => {
    const { status } = this.props
    const items = []

    for (const [index, statusItem] of status.entries()) {
      const isOperational = Boolean(statusItem.succ)

      const icon = isOperational ? (
        <CheckCircleOutlineIcon style={{ color: green[500] }} />
      ) : (
        <ErrorIcon style={{ color: red[500] }} />
      )

      const classNames = []
      if (isOperational) classNames.push('operational')

      const time = dayjs.unix(statusItem.timestamp)
      const secondary =
        `${time.fromNow()} - ` + (statusItem.reason || 'Operational')

      items.push(
        <ListItem key={index}>
          <ListItemText
            primary={constants.jobDetails[statusItem.type]}
            secondary={secondary}
          />
          <ListItemSecondaryAction>{icon}</ListItemSecondaryAction>
        </ListItem>
      )
    }

    const body = (
      <Container maxWidth='sm'>
        <Paper style={{ marginTop: '36px' }}>
          <List>{items}</List>
        </Paper>
      </Container>
    )

    return <PageLayout body={body} scroll />
  }
}

StatusPage.propTypes = {
  load: PropTypes.func,
  status: ImmutablePropTypes.list
}
