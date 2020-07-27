import React from 'react'

import { Roster } from '@common'
import PlayerSlot from '@components/player-slot'

import './lineup.styl'

export default class Lineup extends React.Component {
  render () {
    const { league, roster } = this.props

    const r = new Roster({ roster: roster.toJS(), league })

    const starters = []
    for (const { slot, player } of r.starters) {
      starters.push(
        <PlayerSlot key={player} {...{ playerId: player, slot, roster }} />
      )
    }

    const ps = []
    for (const { slot, player } of r.practice) {
      ps.push(
        <PlayerSlot key={player} {...{ playerId: player, slot, roster }} />
      )
    }

    const bench = []
    for (const { slot, player } of r.bench) {
      bench.push(
        <PlayerSlot key={player} {...{ playerId: player, slot, roster }} />
      )
    }

    const ir = []
    for (const { slot, player } of r.ir) {
      ir.push(
        <PlayerSlot key={player} {...{ playerId: player, slot, roster }} />
      )
    }

    return (
      <div className='lineup'>
        <div className='lineup__starters'>
          <div className='dashboard__section'>
            <div className='dashboard__section-header'>
              <div className='dashboard__section-body-header'>
                <div className='player__slot-slotName'>Slot</div>
                <div className='player__item-name'>Name</div>
                <div className='player__item-metric'>Opp</div>
                <div className='player__item-metric'>Avg</div>
                <div className='player__item-metric'>Proj</div>
                <div className='player__item-metric'>Sos</div>
              </div>
            </div>
            <div className='dashboard__section-body'>
              {starters}
            </div>
          </div>
        </div>
        <div className='lineup__inactive'>
          <div className='dashboard__section'>
            <div className='dashboard__section-header'>
              <div className='dashboard__section-body-header'>
                <div className='player__slot-slotName'>Slot</div>
                <div className='player__item-name'>Name</div>
                <div className='player__item-metric'>Opp</div>
                <div className='player__item-metric'>Avg</div>
                <div className='player__item-metric'>Proj</div>
                <div className='player__item-metric'>Sos</div>
              </div>
            </div>
            <div className='dashboard__section-body'>
              {bench}
            </div>
          </div>
          <div className='dashboard__section'>
            <div className='dashboard__section-header'>
              <div className='dashboard__section-body-header'>
                <div className='player__slot-slotName'>Slot</div>
                <div className='player__item-name'>Name</div>
                <div className='player__item-metric'>Opp</div>
                <div className='player__item-metric'>Avg</div>
                <div className='player__item-metric'>Proj</div>
                <div className='player__item-metric'>Sos</div>
              </div>
            </div>
            <div className='dashboard__section-body'>
              {ir}
            </div>
          </div>
          <div className='dashboard__section'>
            <div className='dashboard__section-header'>
              <div className='dashboard__section-body-header'>
                <div className='player__slot-slotName'>Slot</div>
                <div className='player__item-name'>Name</div>
                <div className='player__item-metric'>Opp</div>
                <div className='player__item-metric'>Avg</div>
                <div className='player__item-metric'>Proj</div>
                <div className='player__item-metric'>Sos</div>
              </div>
            </div>
            <div className='dashboard__section-body'>
              {ps}
            </div>
          </div>
        </div>
      </div>
    )
  }
}
