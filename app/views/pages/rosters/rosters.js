import React from 'react'

import PageLayout from '@layouts/page'
import Roster from '@components/roster'
import { getEligibleSlots } from '@common'

import './rosters.styl'

export default class RostersPage extends React.Component {
  componentDidMount = () => {
    this.props.load()
  }

  render = () => {
    const { rosters, league } = this.props

    const labels = []
    const eligible = getEligibleSlots({ pos: 'ALL', bench: true, league, ir: true, ps: true })
    eligible.forEach((slot, index) => {
      labels.push(<div key={index} className='roster__item'>{slot}</div>)
    })

    const items = []
    for (const [index, roster] of rosters.entries()) {
      items.push(<Roster key={index} roster={roster} />)
    }

    const body = (
      <div className='rosters'>
        <div className='rosters__head'>
          {labels}
        </div>
        <div className='rosters__body'>
          {items}
        </div>
      </div>
    )

    return (
      <PageLayout body={body} scroll />
    )
  }
}
