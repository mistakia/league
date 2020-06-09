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
    groups[position] = players.filter(p => p.pos1 === position)
  }

  const items = []

  for (const position in groups) {
    const players = groups[position]
    for (const player of players) {
      items.push(<Player key={player} player={player} />)
    }
  }

  const body = (
    <div className='dashboard'>
      {items}
    </div>
  )

  return (
    <PageLayout body={body} scroll />
  )
}
