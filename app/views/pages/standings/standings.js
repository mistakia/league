import React, { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'
import Toolbar from '@mui/material/Toolbar'

import SelectYear from '@components/select-year'
import { toPercent } from '@libs-shared'
import PageLayout from '@layouts/page'
import ProbabilityLeverageChart from '@components/probability-leverage-chart/probability-leverage-chart'
import { current_season } from '@constants'

function Divider({ title }) {
  return <div className='table__row table__divider sticky__column'>{title}</div>
}

Divider.propTypes = {
  title: PropTypes.string
}

function StandingsTeam({ team, year, is_current_year }) {
  return (
    <div className='table__row'>
      <div className='table__cell text lead-cell sticky__column'>
        <div className='table__cell-text'>{team.name}</div>
      </div>
      <div className='table__cell metric wide_cell'>
        {team.getIn(['stats', 'wins'], 0)}-{team.getIn(['stats', 'losses'], 0)}-
        {team.getIn(['stats', 'ties'], 0)}
      </div>
      <div className='table__cell metric wide_cell'>
        {team.getIn(['stats', 'apWins'], 0)}-
        {team.getIn(['stats', 'apLosses'], 0)}-
        {team.getIn(['stats', 'apTies'], 0)}
      </div>
      <div className='table__cell metric wide_cell'>
        {team.getIn(['stats', 'pf'], 0).toFixed(1)}
      </div>
      {is_current_year && (
        <div className='table__cell metric'>{toPercent(team.playoff_odds)}</div>
      )}
      {is_current_year && (
        <div className='table__cell metric'>{toPercent(team.bye_odds)}</div>
      )}
      {is_current_year && (
        <div className='table__cell metric'>
          {toPercent(team.championship_odds)}
        </div>
      )}
      <div className='table__cell metric'>
        {team.getIn(['stats', 'doi'], 0).toFixed(2)}
      </div>
    </div>
  )
}

StandingsTeam.propTypes = {
  is_current_year: PropTypes.bool,
  team: ImmutablePropTypes.record,
  year: PropTypes.number
}

function Standings({ teams, title, year, is_current_year }) {
  const sorted = teams.sort(
    (a, b) =>
      b.getIn(['stats', 'wins'], 0) - a.getIn(['stats', 'wins'], 0) ||
      b.getIn(['stats', 'pf'], 0) - a.getIn(['stats', 'pf'], 0)
  )

  const overallRows = []
  sorted.forEach((team, key) => {
    overallRows.push(
      <StandingsTeam {...{ key, team, year, is_current_year }} />
    )
  })

  return (
    <div className='section'>
      <Toolbar>
        <div className='section-header-title'>{title}</div>
      </Toolbar>
      <div className='table__container'>
        <div className='table__row table__head'>
          <div className='table__cell text lead-cell sticky__column'>Team</div>
          <div className='table__cell metric wide_cell'>Record</div>
          <div className='table__cell metric wide_cell'>All Play</div>
          <div className='table__cell metric wide_cell'>Points</div>
          {is_current_year && (
            <div className='table__cell metric'>Playoff Odds</div>
          )}
          {is_current_year && (
            <div className='table__cell metric'>Bye Odds</div>
          )}
          {is_current_year && (
            <div className='table__cell metric'>Champ Odds</div>
          )}
          <div className='table__cell metric'>Draft Index</div>
        </div>
        {overallRows}
      </div>
    </div>
  )
}

Standings.propTypes = {
  is_current_year: PropTypes.bool,
  teams: ImmutablePropTypes.map,
  title: PropTypes.string,
  year: PropTypes.number
}

function Overall({ standings, year, is_current_year }) {
  const overallRows = []
  let key = 0
  for (const team of standings.divisionLeaders.values()) {
    overallRows.push(
      <StandingsTeam {...{ key, team, year, is_current_year }} />
    )
    key++
    if (key === 2) {
      overallRows.push(<Divider key={key} title='Bye Teams' />)
      key++
    } else if (key === 5) {
      overallRows.push(<Divider key={key} title='Division Leaders' />)
      key++
    }
  }

  for (const team of standings.wildcardTeams.values()) {
    overallRows.push(
      <StandingsTeam {...{ key, team, year, is_current_year }} />
    )
    key++
    if (key === 8) {
      overallRows.push(<Divider key={key} title='Wildcard Teams' />)
      key++
    }
  }

  return (
    <div className='section'>
      <Toolbar>
        <div className='section-header-title'>Overall</div>
      </Toolbar>
      <div className='table__container'>
        <div className='table__row table__head'>
          <div className='table__cell text lead-cell sticky__column'>Team</div>
          <div className='table__cell metric wide_cell'>Record</div>
          <div className='table__cell metric wide_cell'>All Play</div>
          <div className='table__cell metric wide_cell'>Points</div>
          {is_current_year && (
            <div className='table__cell metric'>Playoff Odds</div>
          )}
          {is_current_year && (
            <div className='table__cell metric'>Bye Odds</div>
          )}
          {is_current_year && (
            <div className='table__cell metric'>Champ Odds</div>
          )}
          <div className='table__cell metric'>Draft Index</div>
        </div>
        {overallRows}
      </div>
    </div>
  )
}

Overall.propTypes = {
  is_current_year: PropTypes.bool,
  standings: PropTypes.object,
  year: PropTypes.number
}

export default function StandingsPage({
  load_league_team_stats,
  standings,
  division_teams_sorted,
  year,
  league
}) {
  const navigate = useNavigate()
  const { lid } = useParams()

  useEffect(() => {
    if (isNaN(lid)) {
      return navigate('/', { replace: true })
    }
  }, [lid, navigate])

  useEffect(() => {
    load_league_team_stats(lid)
  }, [year, lid, load_league_team_stats])

  const is_current_year = year === current_season.year

  const divisions = []
  for (const [div, teams] of division_teams_sorted.entries()) {
    const division_name = league[`division_${div}_name`]
      ? league[`division_${div}_name`]
      : `Division ${div}`
    divisions.push(
      <Standings
        key={div}
        title={division_name}
        {...{ is_current_year, teams, year }}
      />
    )
  }

  const body = (
    <div className='league-container'>
      <SelectYear />
      <Overall {...{ standings, year, is_current_year }} />
      {divisions}
      {is_current_year && (
        <ProbabilityLeverageChart teams={standings.teams.toList()} />
      )}
    </div>
  )

  return <PageLayout body={body} scroll />
}

StandingsPage.propTypes = {
  standings: PropTypes.object,
  load_league_team_stats: PropTypes.func,
  year: PropTypes.number,
  division_teams_sorted: ImmutablePropTypes.map,
  league: PropTypes.object
}
