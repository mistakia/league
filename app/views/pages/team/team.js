import React, { useEffect } from 'react'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'
import { useParams, useNavigate } from 'react-router-dom'
import Container from '@mui/material/Container'

import PageLayout from '@layouts/page'
import LeagueSelectTeam from '@components/league-select-team'
import LeagueTeam from '@components/league-team'

import './team.styl'

export default function TeamPage({
  loadTeams,
  loadLeagueTeamStats,
  loadLeaguePlayers,
  teams,
  loadDraftPickValue
}) {
  const { lid, tid } = useParams()
  const navigate = useNavigate()

  useEffect(() => {
    if (isNaN(lid) || (tid && isNaN(tid))) {
      return navigate('/', { replace: true })
    }

    loadTeams(lid)
    loadLeaguePlayers(lid)
    loadDraftPickValue()
    loadLeagueTeamStats(lid)
  }, [])

  useEffect(() => {
    if (!tid && teams.size) {
      const team = teams.first()
      return navigate(`/leagues/${lid}/teams/${team.uid}`, { replace: true })
    }
  }, [!tid && teams.size])

  if (!tid) return <PageLayout />

  const teamId = Number(tid)

  const body = (
    <Container maxWidth='xl' classes={{ root: 'league__team' }}>
      <LeagueSelectTeam selected_tid={teamId} />
      <LeagueTeam tid={teamId} />
    </Container>
  )

  return <PageLayout body={body} scroll />
}

TeamPage.propTypes = {
  loadTeams: PropTypes.func,
  loadLeagueTeamStats: PropTypes.func,
  loadLeaguePlayers: PropTypes.func,
  teams: ImmutablePropTypes.map,
  loadDraftPickValue: PropTypes.func
}
