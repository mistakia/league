import React from 'react'
import Container from '@material-ui/core/Container'

import PageLayout from '@layouts/page'

import './standings.styl'

function StandingsTeam ({ item }) {
  return (
    <div className='table__row'>
      <div className='table__cell player__item-name'>{item.team.name}</div>
      <div className='table__cell metric'>{item.wins}-{item.losses}-{item.ties}</div>
      <div className='table__cell metric'>{(item.pointsFor || 0).toFixed(1)}</div>
      <div className='table__cell metric'>-</div>
      <div className='table__cell metric'>-</div>
      <div className='table__cell metric'>-</div>
      <div className='table__cell metric'>-</div>
      <div className='table__cell metric'>-</div>
      <div className='table__cell metric'>-</div>
      <div className='table__cell metric'>-</div>
    </div>
  )
}

function Standings ({ items, title }) {
  const sorted = items.sort((a, b) => {
    return b.wins - a.wins || b.pointsFor - a.pointsFor
  })

  const overallRows = []
  for (const [index, item] of sorted.entries()) {
    overallRows.push(
      <StandingsTeam key={index} item={item} />
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
          <div className='table__cell metric'>Wa</div>
          <div className='table__cell metric'>PP</div>
          <div className='table__cell metric'>PP%</div>
          <div className='table__cell metric'>P Odds</div>
        </div>
      </div>
      {overallRows}
    </div>
  )
}

export default class StandingsPage extends React.Component {
  render = () => {
    const { standings } = this.props

    const items = Object.values(standings)
    const divs = {}
    for (const item of items) {
      const { div } = item.team
      if (!divs[div]) divs[div] = []
      divs[div].push(item)
    }

    const divisions = []
    for (const div in divs) {
      divisions.push(
        <Standings key={div} title={`Division ${div}`} items={divs[div]} />
      )
    }

    const body = (
      <Container maxWidth='md' classes={{ root: 'standings' }}>
        <Standings title='Overall' items={items} />
        {divisions}
      </Container>
    )

    return (
      <PageLayout body={body} scroll />
    )
  }
}
