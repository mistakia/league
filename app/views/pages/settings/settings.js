import React from 'react'
import Container from '@mui/material/Container'
import PropTypes from 'prop-types'

import SettingsTeam from '@components/settings-team'
import PageLayout from '@layouts/page'
import SettingsNotifications from '@components/settings-notifications'

import './settings.styl'

export default class SettingsPage extends React.Component {
  render = () => {
    const { userId, teamId, isHosted } = this.props

    const body = (
      <Container classes={{ root: 'settings' }}>
        {teamId && <SettingsTeam tid={teamId} />}
        {userId && isHosted && <SettingsNotifications />}
      </Container>
    )

    return <PageLayout body={body} scroll />
  }
}

SettingsPage.propTypes = {
  userId: PropTypes.number,
  teamId: PropTypes.number,
  isHosted: PropTypes.bool
}
