import React from 'react'
import PropTypes from 'prop-types'

import SettingsTeam from '@components/settings-team'
import PageLayout from '@layouts/page'
import SettingsNotifications from '@components/settings-notifications'

export default class SettingsPage extends React.Component {
  render = () => {
    const { userId, teamId, isHosted } = this.props

    const body = (
      <div className='league-container'>
        {teamId && <SettingsTeam tid={teamId} />}
        {userId && isHosted && <SettingsNotifications />}
      </div>
    )

    return <PageLayout body={body} scroll />
  }
}

SettingsPage.propTypes = {
  userId: PropTypes.number,
  teamId: PropTypes.number,
  isHosted: PropTypes.bool
}
