import React from 'react'
import PropTypes from 'prop-types'

import SettingsTeam from '@components/settings-team'
import PageLayout from '@layouts/page'

export default function TeamSettingsPage({ teamId }) {
  const body = (
    <div className='league-container'>
      {teamId && <SettingsTeam tid={teamId} />}
    </div>
  )

  return <PageLayout body={body} scroll />
}

TeamSettingsPage.propTypes = {
  teamId: PropTypes.number
}
