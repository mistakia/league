import React, { useEffect } from 'react'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'
import { useParams, useNavigate } from 'react-router-dom'

import PageLayout from '@layouts/page'
import LeagueSelectTeam from '@components/league-select-team'
import LeagueTeam from '@components/league-team'
import LeagueTeamHistoricalRanks from '@components/league-team-historical-ranks'

import './team.styl'

export default function TeamPage({
  load_teams,
  load_league_team_stats,
  load_league_players,
  teams,
  load_draft_pick_value,
  load_league_careerlogs
}) {
  const { lid, tid } = useParams()
  const navigate = useNavigate()

  useEffect(() => {
    if (isNaN(lid) || (tid && isNaN(tid))) {
      return navigate('/', { replace: true })
    }

    load_teams(lid)
    load_league_players(lid)
    load_draft_pick_value()
    load_league_team_stats(lid)
    load_league_careerlogs(lid)
  }, [
    lid,
    tid,
    load_teams,
    load_league_players,
    load_draft_pick_value,
    load_league_team_stats,
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
      <div className='league-page-top'>
        <LeagueSelectTeam selected_tid={teamId} />
        <div className='league-page-top-metrics'>
          <LeagueTeamHistoricalRanks tid={teamId} />
        </div>
      </div>
      <LeagueTeam tid={teamId} />
    </div>
  )

  return <PageLayout body={body} scroll />
}

TeamPage.propTypes = {
  load_teams: PropTypes.func,
  load_league_team_stats: PropTypes.func,
  load_league_players: PropTypes.func,
  teams: ImmutablePropTypes.map,
  load_draft_pick_value: PropTypes.func,
  load_league_careerlogs: PropTypes.func
}
