import React from 'react'

import PlayerRoster from '@components/player-roster'
import PageLayout from '@layouts/page'
import { constants } from '@common'

import './dashboard.styl'

export default function () {
  const { players, picks, league } = this.props
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
      if (!player.player) continue
      activeItems.push(<PlayerRoster key={player.player} player={player} />)
    }
  }

  const practiceItems = []
  for (const player of players.practice) {
    if (!player.player) continue
    practiceItems.push(<PlayerRoster key={player.player} player={player} />)
  }

  const pickItems = []
  for (const pick of picks) {
    const pickNum = (pick.pick % league.nteams) || league.nteams
    const pickStr = `${pick.round}.${('0' + pickNum).slice(-2)}`
    pickItems.push(
      <div key={pick.uid} className='player__item'>
        <div className='player__item-name'>{pick.year}</div>
        <div className='player__item-metric'>{pick.pick && pickStr}</div>
        <div className='player__item-metric'>{pick.round}</div>
        <div className='player__item-metric'>{pick.pick}</div>
      </div>
    )
  }

  const body = (
    <div className='dashboard'>
      <div className='dashboard__section'>
        <div className='dashboard__section-header'>
          <div className='dashboard__section-header-title'>Active Roster</div>
          <div className='dashboard__section-body-header'>
            <div className='player__item-position' />
            <div className='player__item-name'>Name</div>
            <div className='player__item-metric'>Bye</div>
            <div className='player__item-metric'>Value</div>
            <div className='player__item-metric'>Contract</div>
            <div className='player__item-metric'>Starts</div>
            <div className='player__item-metric'>Pts+</div>
            <div className='player__item-metric'>Bench+</div>
            <div className='player__item-action' />
          </div>
        </div>
        <div className='dashboard__section-body empty'>
          {activeItems}
        </div>
      </div>
      <div className='dashboard__section'>
        <div className='dashboard__section-header'>
          <div className='dashboard__section-header-title'>Practice Squad</div>
          <div className='dashboard__section-body-header'>
            <div className='player__item-position' />
            <div className='player__item-name'>Name</div>
            <div className='player__item-metric'>Bye</div>
            <div className='player__item-metric'>Value</div>
            <div className='player__item-metric'>Contract</div>
            <div className='player__item-metric'>Starts</div>
            <div className='player__item-metric'>Pts+</div>
            <div className='player__item-metric'>Bench+</div>
            <div className='player__item-action' />
          </div>
        </div>
        <div className='dashboard__section-body empty'>
          {practiceItems}
        </div>
      </div>
      <div className='dashboard__section'>
        <div className='dashboard__section-header'>
          <div className='dashboard__section-header-title'>Draft Picks</div>
          <div className='dashboard__section-body-header'>
            <div className='player__item-name'>Year</div>
            <div className='player__item-metric'>Pick</div>
            <div className='player__item-metric'>Round</div>
            <div className='player__item-metric'>Pick #</div>
          </div>
        </div>
        <div className='dashboard__section-body empty'>
          {pickItems}
        </div>
      </div>
    </div>
  )

  return (
    <PageLayout body={body} scroll />
  )
}
