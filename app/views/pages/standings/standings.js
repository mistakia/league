import React from 'react'
import Container from '@material-ui/core/Container'

import { constants, toPercent } from '@common'
import PageLayout from '@layouts/page'

import './standings.styl'

const gs = constants.season.week - 1

function StandingsTeam ({ team }) {
  return (
    <div className='table__row'>
      <div className='table__cell player__item-name'>{team.name}</div>
      <div className='table__cell metric'>{team.wins}-{team.losses}-{team.ties}</div>
      <div className='table__cell metric'>{(team.pointsFor || 0).toFixed(1)}</div>
      <div className='table__cell metric'>{(team.pointsAgainst || 0).toFixed(1)}</div>
      <div className='table__cell metric'>{((team.pointsFor / gs) || 0).toFixed(1)}</div>
      <div className='table__cell metric'>{((team.pointsAgainst / gs) || 0).toFixed(1)}</div>
      <div className='table__cell metric'>{toPercent(team.playoffOdds)}</div>
      <div className='table__cell metric'>{(team.potentialPointsFor || 0).toFixed(1)}</div>
      <div className='table__cell metric'>{toPercent(team.pointsFor / team.potentialPointsFor)}</div>
      <div className='table__cell metric'>{(team.draftOrderIndex || 0).toFixed(2)}</div>
    </div>
  )
}

function Standings ({ teams, title }) {
  const sorted = teams.sort((a, b) => b.wins - a.wins || b.pointsFor - a.pointsFor)

  const overallRows = []
  for (const [index, team] of sorted.entries()) {
    overallRows.push(
      <StandingsTeam key={index} team={team} />
    )
  }

  return (
    <div className='section'>
      <div className='dashboard__section-header-title'>{title}</div>
      <div className='table__container'>
        <div className='table__row table__head'>
          <div className='table__cell player__item-name'>Team</div>
          <div className='table__cell metric'>Rec</div>
          <div className='table__cell metric'>PF</div>
          <div className='table__cell metric'>PA</div>
          <div className='table__cell metric'>PF/G</div>
          <div className='table__cell metric'>PA/G</div>
          <div className='table__cell metric'>P Odds</div>
          <div className='table__cell metric'>PP</div>
          <div className='table__cell metric'>PP%</div>
          <div className='table__cell metric'>DOI</div>
        </div>
      </div>
      {overallRows}
    </div>
  )
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

    return (
      <PageLayout body={body} scroll />
    )
  }
}
