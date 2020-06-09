import React from 'react'

import { getEligibleSlots, constants } from '@common'
import PlayerSlot from '@components/player-slot'

import './roster.styl'

class Roster extends React.Component {
  render () {
    const { league, roster } = this.props

    const slots = []
    const eligible = getEligibleSlots({ bench: true, league, ir: true, ps: true })
    for (const slot of eligible) {
      const slotId = constants.slots[slot]
      const playerId = roster[`s${slotId}`]
      slots.push(
        <PlayerSlot key={slot} {...{ slotId, playerId, slot, roster }} />
      )
    }

    return (
      <div className='roster'>
        {slots}
      </div>
    )
  }
}

export default Roster
