import React from 'react'
import PropTypes from 'prop-types'
import Container from '@mui/material/Container'

import EditableLeague from '@components/editable-league'
import EditableTeams from '@components/editable-teams'
import PageLayout from '@layouts/page'

export default function LeagueSettingsPage({ leagueId }) {
  const body = (
    <Container maxWidth='md' classes={{ root: 'settings' }}>
      <EditableLeague lid={leagueId} />
      {Boolean(leagueId) && <EditableTeams />}
    </Container>
  )

  return <PageLayout body={body} scroll />
}

LeagueSettingsPage.propTypes = {
  leagueId: PropTypes.number
}
