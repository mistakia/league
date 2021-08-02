import React from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'
import Container from '@material-ui/core/Container'

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
    for (const group in groups) {
      const items = []
      const groupItems = groups[group]
      for (const [index, matchup] of groupItems.entries()) {
        items.push(<Matchup key={index} matchup={matchup} />)
      }
      const section = (
        <div key={group} className='schedule__section'>
          {items}
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
        <div className='schedule__body'>{sections}</div>
      </Container>
    )

    return <PageLayout body={body} scroll />
  }
}

SchedulePage.propTypes = {
  matchups: ImmutablePropTypes.list
}
