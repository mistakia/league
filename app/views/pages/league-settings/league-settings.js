import React from 'react'
import PropTypes from 'prop-types'

import EditableLeague from '@components/editable-league'
import EditableTeams from '@components/editable-teams'
import PageLayout from '@layouts/page'

export default function LeagueSettingsPage({ leagueId }) {
  const body = (
    <div className='league-container'>
      <EditableLeague lid={leagueId} />
      {Boolean(leagueId) && <EditableTeams />}
    </div>
  )

  return <PageLayout body={body} scroll />
}

LeagueSettingsPage.propTypes = {
  leagueId: PropTypes.number
}
