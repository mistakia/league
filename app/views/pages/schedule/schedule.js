import React, { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'
import Container from '@mui/material/Container'

import PageLayout from '@layouts/page'
import Matchup from '@components/matchup'
import SelectYear from '@components/select-year'
import ScheduleWeeksFilter from '@components/schedule-weeks-filter'
import ScheduleTeamsFilter from '@components/schedule-teams-filter'
import { groupBy } from '@common'

import './schedule.styl'

export default function SchedulePage({ matchups, load }) {
  const { lid } = useParams()
  const navigate = useNavigate()

  useEffect(() => {
    if (isNaN(lid)) {
      return navigate('/', { replace: true })
    }

    load(lid)
  }, [lid, load, navigate])

  const sections = []
  const groups = groupBy(matchups, 'week')
  Object.entries(groups).forEach((entry, index) => {
    const week = entry[0]
    const matchups = entry[1]
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
  })

  const body = (
    <Container maxWidth='md'>
      <div className='schedule__filter'>
        <SelectYear />
        <ScheduleWeeksFilter />
        <ScheduleTeamsFilter />
      </div>
      <div className='schedule__body empty'>{sections}</div>
    </Container>
  )

  return <PageLayout body={body} scroll />
}

SchedulePage.propTypes = {
  matchups: ImmutablePropTypes.list,
  load: PropTypes.func
}
