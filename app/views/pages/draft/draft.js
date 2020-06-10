import React from 'react'

import PageLayout from '@layouts/page'
import DraftPlayer from '@components/draft-player'
import { constants } from '@common'

import './draft.styl'

export default function () {
  const { players } = this.props
  const { positions } = constants

  const groups = {}
  for (const position of positions) {
    if (!groups[position]) groups[position] = []
    const ps = players.filter(p => p.pos1 === position)
    groups[position] = ps.sort((a, b) => b.values.get('available') - a.values.get('available'))
  }

  const items = {}

  for (const position in groups) {
    if (!items[position]) items[position] = []
    const players = groups[position]
    for (const player of players) {
      items[position].push(<DraftPlayer key={player} player={player} />)
    }
  }

  const body = (
    <div className='draft'>
      <div className='draft__players'></div>
      <div className='draft__main'>
        <div className='draft__main-board'>
          <div className='draft__main-board-pos'>
            {items['QB']}
          </div>
          <div className='draft__main-board-pos'>
            {items['RB']}
          </div>
          <div className='draft__main-board-pos'>
            {items['WR']}
          </div>
          <div className='draft__main-board-pos'>
            {items['TE']}
          </div>
        </div>
        <div className='draft__main-trade'>
        </div>
      </div>
      <div className='draft__side'>
        <div className='draft__side-top'>
          <strong>Pick #1 (1.01)</strong>
          <h2>On The Clock</h2>
        </div>
        <div className='draft__side-main'>

        </div>
      </div>
    </div>
  )

  return (
    <PageLayout body={body} />
  )
}
