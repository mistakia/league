import React from 'react'
import PropTypes from 'prop-types'

import './scoreboard-slots.styl'
import { roster_slot_types } from '@constants'

export default class ScoreboardSlots extends React.Component {
  render = () => {
    const { league } = this.props
    const rows = []
    const slots = [
      'qb',
      'rb',
      'wr',
      'rbwr',
      'rbwrte',
      'qbrbwrte',
      'wrte',
      'te',
      'k',
      'dst'
    ]
    let index = 0
    for (const slot of slots) {
      for (let i = 0; i < league[`s${slot}`]; i++) {
        const s = roster_slot_types[`${slot.toUpperCase()}`]
        rows.push(
          <div key={index} className='scoreboard__slots-slot'>
            {roster_slot_types.slotName[s]}
          </div>
        )
        index += 1
      }
    }

    return <div className='scoreboard__slots'>{rows}</div>
  }
}

ScoreboardSlots.propTypes = {
  league: PropTypes.object
}
