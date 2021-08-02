import React from 'react'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'
import Container from '@material-ui/core/Container'

import { toPercent } from '@common'
import PageLayout from '@layouts/page'

import './standings.styl'

function StandingsTeam({ team }) {
  return (
    <div className='table__row'>
      <div className='table__cell player__item-name'>{team.name}</div>
      <div className='table__cell metric'>
        {team.getIn(['stats', 'wins'], 0)}-{team.getIn(['stats', 'losses'], 0)}-
        {team.getIn(['stats', 'ties'], 0)}
      </div>
      <div className='table__cell metric'>
        {team.getIn(['stats', 'pf'], 0).toFixed(1)}
      </div>
      <div className='table__cell metric'>{toPercent(team.playoffOdds)}</div>
      <div className='table__cell metric'>{toPercent(team.byeOdds)}</div>
      <div className='table__cell metric'>
        {team.getIn(['stats', 'doi'], 0).toFixed(2)}
      </div>
    </div>
  )
}

StandingsTeam.propTypes = {
  team: ImmutablePropTypes.map
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
      <div className='dashboard__section-header-title'>{title}</div>
      <div className='table__container'>
        <div className='table__row table__head'>
          <div className='table__cell player__item-name'>Team</div>
          <div className='table__cell metric'>Rec</div>
          <div className='table__cell metric'>PF</div>
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

export default class StandingsPage extends React.Component {
  render = () => {
    const { teams } = this.props

    const divs = {}
    for (const team of teams.valueSeq()) {
      const div = team.get('div')
      if (!divs[div]) divs[div] = []
      divs[div].push(team)
    }

    const divisions = []
    for (const div in divs) {
      divisions.push(
        <Standings key={div} title={`Division ${div}`} teams={divs[div]} />
      )
    }

    const body = (
      <Container maxWidth='md' classes={{ root: 'standings' }}>
        <Standings title='Overall' teams={teams} />
        {divisions}
      </Container>
    )

    return <PageLayout body={body} scroll />
  }
}

StandingsPage.propTypes = {
  teams: ImmutablePropTypes.map
}
