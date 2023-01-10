import React, { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'
import Container from '@mui/material/Container'
import Toolbar from '@mui/material/Toolbar'

import SelectYear from '@components/select-year'
import { toPercent } from '@common'
import PageLayout from '@layouts/page'

import './standings.styl'

function Divider({ title }) {
  return <div className='table__row table__divider'>{title}</div>
}

Divider.propTypes = {
  title: PropTypes.string
}

function StandingsTeam({ team, year }) {
  return (
    <div className='table__row'>
      <div className='table__cell player__item-name'>{team.name}</div>
      <div className='table__cell metric'>
        {team.getIn(['stats', year, 'wins'], 0)}-
        {team.getIn(['stats', year, 'losses'], 0)}-
        {team.getIn(['stats', year, 'ties'], 0)}
      </div>
      <div className='table__cell metric'>
        {team.getIn(['stats', year, 'apWins'], 0)}-
        {team.getIn(['stats', year, 'apLosses'], 0)}-
        {team.getIn(['stats', year, 'apTies'], 0)}
      </div>
      <div className='table__cell metric'>
        {team.getIn(['stats', year, 'pf'], 0).toFixed(1)}
      </div>
      <div className='table__cell metric'>{toPercent(team.playoff_odds)}</div>
      <div className='table__cell metric'>{toPercent(team.bye_odds)}</div>
      <div className='table__cell metric'>
        {toPercent(team.championship_odds)}
      </div>
      <div className='table__cell metric'>
        {team.getIn(['stats', year, 'doi'], 0).toFixed(2)}
      </div>
    </div>
  )
}

StandingsTeam.propTypes = {
  team: ImmutablePropTypes.record,
  year: PropTypes.number
}

function Standings({ teams, title, year }) {
  const sorted = teams.sort(
    (a, b) =>
      b.getIn(['stats', year, 'wins'], 0) -
        a.getIn(['stats', year, 'wins'], 0) ||
      b.getIn(['stats', year, 'pf'], 0) - a.getIn(['stats', year, 'pf'], 0)
  )

  const overallRows = []
  sorted.forEach((team, index) => {
    overallRows.push(<StandingsTeam key={index} team={team} year={year} />)
  })

  return (
    <div className='section'>
      <Toolbar>
        <div className='dashboard__section-header-title'>{title}</div>
      </Toolbar>
      <div className='table__container'>
        <div className='table__row table__head'>
          <div className='table__cell player__item-name'>Team</div>
          <div className='table__cell metric'>Record</div>
          <div className='table__cell metric'>All Play</div>
          <div className='table__cell metric'>Points</div>
          <div className='table__cell metric'>P Odds</div>
          <div className='table__cell metric'>Bye Odds</div>
          <div className='table__cell metric'>C Odds</div>
          <div className='table__cell metric'>DOI</div>
        </div>
        {overallRows}
      </div>
    </div>
  )
}

Standings.propTypes = {
  teams: ImmutablePropTypes.map,
  title: PropTypes.string,
  year: PropTypes.number
}

function Overall({ standings, year }) {
  const overallRows = []
  let key = 0
  for (const team of standings.divisionLeaders.values()) {
    overallRows.push(<StandingsTeam key={key} team={team} year={year} />)
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
    overallRows.push(<StandingsTeam key={key} team={team} year={year} />)
    key++
    if (key === 8) {
      overallRows.push(<Divider key={key} title='Wildcard Teams' />)
      key++
    }
  }

  return (
    <div className='section'>
      <Toolbar>
        <div className='dashboard__section-header-title'>Overall</div>
      </Toolbar>
      <div className='table__container'>
        <div className='table__row table__head'>
          <div className='table__cell player__item-name'>Team</div>
          <div className='table__cell metric'>Record</div>
          <div className='table__cell metric'>All Play</div>
          <div className='table__cell metric'>Points</div>
          <div className='table__cell metric'>P Odds</div>
          <div className='table__cell metric'>Bye Odds</div>
          <div className='table__cell metric'>C Odds</div>
          <div className='table__cell metric'>DOI</div>
        </div>
        {overallRows}
      </div>
    </div>
  )
}

Overall.propTypes = {
  standings: PropTypes.object,
  year: PropTypes.number
}

export default function StandingsPage({
  loadLeagueTeamStats,
  standings,
  division_teams_sorted,
  year
}) {
  const navigate = useNavigate()
  const { lid } = useParams()

  useEffect(() => {
    if (isNaN(lid)) {
      return navigate('/', { replace: true })
    }
  }, [])

  useEffect(() => {
    loadLeagueTeamStats(lid)
  }, [year])

  const divisions = []
  for (const [div, teams] of division_teams_sorted.entries()) {
    divisions.push(
      <Standings
        key={div}
        title={`Division ${div}`}
        teams={teams}
        year={year}
      />
    )
  }

  const body = (
    <Container maxWidth='md' classes={{ root: 'standings' }}>
      <SelectYear />
      <Overall standings={standings} year={year} />
      {divisions}
    </Container>
  )

  return <PageLayout body={body} scroll />
}

StandingsPage.propTypes = {
  standings: PropTypes.object,
  loadLeagueTeamStats: PropTypes.func,
  year: PropTypes.number,
  division_teams_sorted: ImmutablePropTypes.map
}
