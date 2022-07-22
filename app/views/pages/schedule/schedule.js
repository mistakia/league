import React from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'
import Container from '@mui/material/Container'

import PageLayout from '@layouts/page'
import Matchup from '@components/matchup'
import ScheduleWeeksFilter from '@components/schedule-weeks-filter'
import ScheduleTeamsFilter from '@components/schedule-teams-filter'
import { groupBy } from '@common'

import './schedule.styl'

export default class SchedulePage extends React.Component {
  render = () => {
    const { matchups } = this.props

    const sections = []
    const groups = groupBy(matchups, 'week')
    for (const [index, [week, matchups]] of Object.entries(
      Object.entries(groups)
    )) {
      const items = []
      for (const matchup of matchups) {
        items.push(<Matchup key={matchup.uid} matchup={matchup} />)
      }
      const section = (
        <div key={index} className='schedule__section'>
          <div className='schedule__section-week'>Week {week}</div>
          <div className='schedule__section-matchups'>{items}</div>
        </div>
      )
      sections.push(section)
    }

    const body = (
      <Container maxWidth='md'>
        <div className='schedule__filter'>
          <ScheduleWeeksFilter />
          <ScheduleTeamsFilter />
        </div>
        <div className='schedule__body empty'>{sections}</div>
      </Container>
    )

    return <PageLayout body={body} scroll />
  }
}

SchedulePage.propTypes = {
  matchups: ImmutablePropTypes.list
}
