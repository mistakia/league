import React from 'react'

import PageLayout from '@layouts/page'
import { constants, getEligibleSlots } from '@common'

import './stats.styl'

export default class StatsPage extends React.Component {
  render = () => {
    const { league } = this.props

    const lineupHeaders = []
    const eligibleStarterSlots = getEligibleSlots({ pos: 'ALL', league })
    for (const slot of eligibleStarterSlots) {
      lineupHeaders.push(<div key={slot} className='player__item-metric'>{slot}</div>)
      lineupHeaders.push(<div key={`${slot}%`} className='player__item-metric'>%</div>)
    }

    const positionalHeaders = []
    for (const position of constants.positions) {
      positionalHeaders.push(<div key={position} className='player__item-metric'>{position}</div>)
      positionalHeaders.push(<div key={`${position}%`} className='player__item-metric'>%</div>)
    }

    const body = (
      <div className='stats'>
        <div className='section'>
          <div className='dashboard__section-header-title'>League Stats</div>
          <div className='dashboard__section-body-header'>
            <div className='player__item-position' />
            <div className='player__item-name'>Team</div>
            <div className='player__item-metric'>PF</div>
            <div className='player__item-metric'>OPF</div>
            <div className='player__item-metric'>EFF</div>
            <div className='player__item-metric'>MAX</div>
            <div className='player__item-metric'>MIN</div>
            <div className='player__item-metric'>STDEV</div>
            <div className='player__row-group'>
              <div className='player__row-group-head'>All Play Record</div>
              <div className='player__row-group-body'>
                <div className='player__item-metric'>W</div>
                <div className='player__item-metric'>L</div>
                <div className='player__item-metric'>T</div>
                <div className='player__item-metric'>PCT</div>
              </div>
            </div>
          </div>
          <div className='dashboard__section-body' />
        </div>
        <div className='section'>
          <div className='dashboard__section-header-title'>Lineup Stats</div>
          <div className='dashboard__section-body-header'>
            <div className='player__item-position' />
            <div className='player__item-name'>Team</div>
            {lineupHeaders}
          </div>
          <div className='dashboard__section-body' />
        </div>
        <div className='section'>
          <div className='dashboard__section-header-title'>Positional Stats</div>
          <div className='dashboard__section-body-header'>
            <div className='player__item-position' />
            <div className='player__item-name'>Team</div>
            {positionalHeaders}
          </div>
          <div className='dashboard__section-body' />
        </div>
      </div>
    )

    return (
      <PageLayout body={body} />
    )
  }
}
