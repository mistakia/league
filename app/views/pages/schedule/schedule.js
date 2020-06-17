import React from 'react'

import PageLayout from '@layouts/page'
import Matchup from '@components/matchup'
import ScheduleWeeksFilter from '@components/schedule-weeks-filter'
import ScheduleTeamsFilter from '@components/schedule-teams-filter'

import './schedule.styl'

export default class SchedulePage extends React.Component {
  componentDidMount = () => {
    this.props.load()
  }

  render = () => {
    const { matchups } = this.props

    const items = []
    for (const [index, matchup] of matchups.entries()) {
      items.push(<Matchup key={index} matchup={matchup} />)
    }

    const body = (
      <div className='schedule'>
        <div className='schedule__filter'>
          <ScheduleWeeksFilter />
          <ScheduleTeamsFilter />
        </div>
        <div className='schedule__body'>
          {items}
        </div>
      </div>
    )

    return (
      <PageLayout body={body} scroll />
    )
  }
}
