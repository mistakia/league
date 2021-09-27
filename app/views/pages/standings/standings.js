import React from 'react'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'
import Container from '@material-ui/core/Container'
import Toolbar from '@material-ui/core/Toolbar'

import { toPercent } from '@common'
import PageLayout from '@layouts/page'

import './standings.styl'

function Divider({ title }) {
  return <div className='table__row table__divider'>{title}</div>
}

Divider.propTypes = {
  title: PropTypes.string
}

function StandingsTeam({ team }) {
  return (
    <div className='table__row'>
      <div className='table__cell player__item-name'>{team.name}</div>
      <div className='table__cell metric'>
        {team.getIn(['stats', 'wins'], 0)}-{team.getIn(['stats', 'losses'], 0)}-
        {team.getIn(['stats', 'ties'], 0)}
      </div>
      <div className='table__cell metric'>
        {team.getIn(['stats', 'apWins'], 0)}-
        {team.getIn(['stats', 'apLosses'], 0)}-
        {team.getIn(['stats', 'apTies'], 0)}
      </div>
      <div className='table__cell metric'>
        {team.getIn(['stats', 'pf'], 0).toFixed(1)}
      </div>
      <div className='table__cell metric'>{toPercent(team.playoff_odds)}</div>
      <div className='table__cell metric'>{toPercent(team.bye_odds)}</div>
      <div className='table__cell metric'>
        {team.getIn(['stats', 'doi'], 0).toFixed(2)}
      </div>
    </div>
  )
}

StandingsTeam.propTypes = {
  team: ImmutablePropTypes.record
}

function Standings({ teams, title }) {
  const sorted = teams.sort(
    (a, b) =>
      b.getIn(['stats', 'wins'], 0) - a.getIn(['stats', 'wins'], 0) ||
      b.getIn(['stats', 'pf'], 0) - a.getIn(['stats', 'pf'], 0)
  )

  const overallRows = []
  for (const [index, team] of sorted.entries()) {
    overallRows.push(<StandingsTeam key={index} team={team} />)
  }

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
          <div className='table__cell metric'>DOI</div>
        </div>
      </div>
      {overallRows}
    </div>
  )
}

Standings.propTypes = {
  teams: ImmutablePropTypes.map,
  title: PropTypes.string
}

function Overall({ standings }) {
  const overallRows = []
  let key = 0
  for (const team of standings.divisionLeaders.values()) {
    overallRows.push(<StandingsTeam key={key} team={team} />)
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
    overallRows.push(<StandingsTeam key={key} team={team} />)
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
          <div className='table__cell metric'>DOI</div>
        </div>
      </div>
      {overallRows}
    </div>
  )
}

Overall.propTypes = {
  standings: PropTypes.object
}

export default class StandingsPage extends React.Component {
  render = () => {
    const { standings } = this.props

    const divisions = []
    for (const [div, teams] of standings.divisionTeams.entries()) {
      divisions.push(
        <Standings key={div} title={`Division ${div}`} teams={teams} />
      )
    }

    const body = (
      <Container maxWidth='md' classes={{ root: 'standings' }}>
        <Overall standings={standings} />
        {divisions}
      </Container>
    )

    return <PageLayout body={body} scroll />
  }
}

StandingsPage.propTypes = {
  standings: PropTypes.object
}
