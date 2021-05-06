import React from 'react'
import Container from '@material-ui/core/Container'

import EditableLeague from '@components/editable-league'
import SettingsTeam from '@components/settings-team'
import PageLayout from '@layouts/page'
import EditableTeams from '@components/editable-teams'
import SettingsProjections from '@components/settings-projections'
import SettingsValue from '@components/settings-value'
import SettingsNotifications from '@components/settings-notifications'

import './settings.styl'

export default class SettingsPage extends React.Component {
  render = () => {
    const { userId, leagueId, teamId, isHosted } = this.props

    const body = (
      <Container maxWidth='lg' classes={{ root: 'settings' }}>
        <div>
          <EditableLeague lid={leagueId} />
          {teamId && <SettingsTeam tid={teamId} />}
          <SettingsValue />
          <SettingsProjections />
          {userId && isHosted && <SettingsNotifications />}
        </div>
        <EditableTeams />
      </Container>
    )

    return <PageLayout body={body} scroll />
  }
}
