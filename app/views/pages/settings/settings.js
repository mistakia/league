import React from 'react'
import Container from '@mui/material/Container'
import PropTypes from 'prop-types'

import EditableLeague from '@components/editable-league'
import SettingsTeam from '@components/settings-team'
import PageLayout from '@layouts/page'
import EditableTeams from '@components/editable-teams'
import SettingsNotifications from '@components/settings-notifications'

import './settings.styl'

export default class SettingsPage extends React.Component {
  render = () => {
    const { userId, leagueId, teamId, isHosted } = this.props

    const body = (
      <Container classes={{ root: 'settings' }}>
        <div>
          <EditableLeague lid={leagueId} />
          {teamId && <SettingsTeam tid={teamId} />}
          {userId && isHosted && <SettingsNotifications />}
        </div>
        <EditableTeams />
      </Container>
    )

    return <PageLayout body={body} scroll />
  }
}

SettingsPage.propTypes = {
  userId: PropTypes.number,
  leagueId: PropTypes.number,
  teamId: PropTypes.number,
  isHosted: PropTypes.bool
}
