import React, { useEffect } from 'react'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'
import { useParams, useNavigate } from 'react-router-dom'

import PageLayout from '@layouts/page'
import LeagueSelectTeam from '@components/league-select-team'
import LeagueTeam from '@components/league-team'

import './team.styl'

export default function TeamPage({
  loadTeams,
  loadLeagueTeamStats,
  loadLeaguePlayers,
  teams,
  loadDraftPickValue,
  load_league_careerlogs
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
    load_league_careerlogs(lid)
  }, [
    lid,
    tid,
    loadTeams,
    loadLeaguePlayers,
    loadDraftPickValue,
    loadLeagueTeamStats,
    load_league_careerlogs,
    navigate
  ])

  const league_loaded_and_no_tid = !tid && teams.size
  useEffect(() => {
    if (!tid && teams.size) {
      const team = teams.first()
      return navigate(`/leagues/${lid}/teams/${team.uid}`, { replace: true })
    }
  }, [lid, tid, league_loaded_and_no_tid, teams, navigate])

  if (!tid) return <PageLayout />

  const teamId = Number(tid)

  const body = (
    <div className='league-container full'>
      <LeagueSelectTeam selected_tid={teamId} />
      <LeagueTeam tid={teamId} />
    </div>
  )

  return <PageLayout body={body} scroll />
}

TeamPage.propTypes = {
  loadTeams: PropTypes.func,
  loadLeagueTeamStats: PropTypes.func,
  loadLeaguePlayers: PropTypes.func,
  teams: ImmutablePropTypes.map,
  loadDraftPickValue: PropTypes.func,
  load_league_careerlogs: PropTypes.func
}
