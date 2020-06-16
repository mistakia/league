import React from 'react'

import { getEligibleSlots, constants } from '@common'
import PlayerSlot from '@components/player-slot'

import './lineup.styl'

class Lineup extends React.Component {
  render () {
    const { league, roster } = this.props

    const slots = []
    const eligible = getEligibleSlots({ pos: 'ALL', bench: true, league, ir: true, ps: true })
    for (const slot of eligible) {
      const slotId = constants.slots[slot]
      const playerId = roster[`s${slotId}`]
      slots.push(
        <PlayerSlot key={slot} {...{ slotId, playerId, slot, roster }} />
      )
    }

    const starters = []
    for (const slot of getEligibleSlots({ pos: 'ALL', league })) {
      const slotId = constants.slots[slot]
      const playerId = roster[`s${slotId}`]
      starters.push(
        <PlayerSlot key={slot} {...{ slotId, playerId, slot, roster }} />
      )
    }

    const ps = []
    for (const slot of getEligibleSlots({ ps: true, league })) {
      const slotId = constants.slots[slot]
      const playerId = roster[`s${slotId}`]
      ps.push(
        <PlayerSlot key={slot} {...{ slotId, playerId, slot, roster }} />
      )
    }

    const bench = []
    for (const slot of getEligibleSlots({ bench: true, league })) {
      const slotId = constants.slots[slot]
      const playerId = roster[`s${slotId}`]
      bench.push(
        <PlayerSlot key={slot} {...{ slotId, playerId, slot, roster }} />
      )
    }

    const ir = []
    for (const slot of getEligibleSlots({ ir: true, league })) {
      const slotId = constants.slots[slot]
      const playerId = roster[`s${slotId}`]
      ir.push(
        <PlayerSlot key={slot} {...{ slotId, playerId, slot, roster }} />
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

export default Lineup
