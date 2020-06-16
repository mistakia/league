import React from 'react'

import Player from '@components/player'
import PageLayout from '@layouts/page'
import { constants } from '@common'

import './dashboard.styl'

export default function () {
  const { players } = this.props
  const { positions } = constants

  const groups = {}
  for (const position of positions) {
    if (!groups[position]) groups[position] = []
    groups[position] = players.active.filter(p => p.pos1 === position)
  }

  const activeItems = []

  for (const position in groups) {
    const players = groups[position]
    for (const player of players) {
      activeItems.push(<Player key={player} player={player} />)
    }
  }

  const practiceItems = []
  for (const player of players.practice) {
    practiceItems.push(<Player key={player} player={player} />)
  }

  const body = (
    <div className='dashboard'>
      <div className='dashboard__section'>
        <div className='dashboard__section-header'>
          <div className='dashboard__section-header-title'>Active Roster</div>
          <div className='dashboard__section-body-header'>
            <div className='player__item-position'></div>
            <div className='player__item-name'>Name</div>
            <div className='player__item-metric'>Bye</div>
            <div className='player__item-metric'>Value</div>
            <div className='player__item-metric'>Contract</div>
            <div className='player__item-metric'>Starts</div>
            <div className='player__item-metric'>Pts+</div>
            <div className='player__item-metric'>Bench+</div>
          </div>
        </div>
        <div className='dashboard__section-body'>
          {activeItems}
        </div>
      </div>
      <div className='dashboard__section'>
        <div className='dashboard__section-header'>
          <div className='dashboard__section-header-title'>Practice Squad</div>
          <div className='dashboard__section-body-header'>
            <div className='player__item-position'></div>
            <div className='player__item-name'>Name</div>
            <div className='player__item-metric'>Bye</div>
            <div className='player__item-metric'>Value</div>
            <div className='player__item-metric'>Contract</div>
            <div className='player__item-metric'>Starts</div>
            <div className='player__item-metric'>Pts+</div>
            <div className='player__item-metric'>Bench+</div>
          </div>
        </div>
        <div className='dashboard__section-body'>
          {practiceItems}
        </div>
      </div>
    </div>
  )

  return (
    <PageLayout body={body} scroll />
  )
}
