import React from 'react'
import moment from 'moment'

import Paper from '@material-ui/core/Paper'
import Container from '@material-ui/core/Container'
import { green, red } from '@material-ui/core/colors'
import List from '@material-ui/core/List'
import ListItem from '@material-ui/core/ListItem'
import ListItemSecondaryAction from '@material-ui/core/ListItemSecondaryAction'
import ListItemText from '@material-ui/core/ListItemText'
import CheckCircleOutlineIcon from '@material-ui/icons/CheckCircleOutline'
import ErrorIcon from '@material-ui/icons/Error'

import { constants } from '@common'
import PageLayout from '@layouts/page'

export default class StatusPage extends React.Component {
  componentDidMount = () => {
    this.props.load()
  }

  render = () => {
    const { status } = this.props
    const items = []

    for (const [index, statusItem] of status.entries()) {
      const isOperational = !!statusItem.succ

      const icon = isOperational ? (
        <CheckCircleOutlineIcon style={{ color: green[500] }} />
      ) : (
        <ErrorIcon style={{ color: red[500] }} />
      )

      const classNames = []
      if (isOperational) classNames.push('operational')

      const time = moment(statusItem.timestamp, 'X')
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
