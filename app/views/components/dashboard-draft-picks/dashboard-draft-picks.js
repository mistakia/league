import React from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'
import PropTypes from 'prop-types'

import TeamName from '@components/team-name'
import { groupBy, nth } from '@common'

import './dashboard-draft-picks.styl'

function SeasonDraftPicks({ picks, year }) {
  const sortedPicks = picks.sort((a, b) => a.round - b.round || a.pick - b.pick)
  const pickItems = []
  for (const pick of sortedPicks) {
    pickItems.push(
      <div key={pick.uid} className='player__item table__row'>
        {/* <div className='metric table__cell'>{pick.pick || '-'}</div> */}
        <div className='metric table__cell'>
          {pick.pick_str ? pick.pick_str : `${pick.round}${nth(pick.round)}`}
        </div>
        <div className='table__cell draft-pick__team'>
          <TeamName tid={pick.otid} />
        </div>
      </div>
    )
  }

  return (
    <div className='season__draft-picks'>
      <div className='season__draft-picks-header'>{year}</div>
      <div className='season__draft-picks-body'>
        <div className='table__container'>
          <div className='table__row table__head'>
            {/* <div className='metric table__cell'>#</div> */}
            <div className='metric table__cell'>Round</div>
            <div className='metric table__cell draft-pick__team'>Team</div>
          </div>
          <div className='table__body empty'>{pickItems}</div>
        </div>
      </div>
    </div>
  )
}

SeasonDraftPicks.propTypes = {
  picks: PropTypes.array,
  year: PropTypes.string
}

export default class DashboardDraftPicks extends React.Component {
  render() {
    const { picks } = this.props

    const draftPicksByYear = groupBy(picks, 'year')
    const draftPickItems = []

    Object.keys(draftPicksByYear).forEach((year, idx) => {
      const draftPicks = draftPicksByYear[year]
      draftPickItems.push(
        <SeasonDraftPicks key={idx} year={year} picks={draftPicks} />
      )
    })

    return <div className='dashboard__draft-picks'>{draftPickItems}</div>
  }
}

DashboardDraftPicks.propTypes = {
  picks: ImmutablePropTypes.list,
  league: PropTypes.object
}
