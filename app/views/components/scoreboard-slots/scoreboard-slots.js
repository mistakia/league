import React from 'react'
import PropTypes from 'prop-types'

import { constants } from '@libs-shared'

import './scoreboard-slots.styl'

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
        const s = constants.slots[`${slot.toUpperCase()}`]
        rows.push(
          <div key={index} className='scoreboard__slots-slot'>
            {constants.slotName[s]}
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
