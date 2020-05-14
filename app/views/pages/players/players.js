import React from 'react'
import AutoSizer from 'react-virtualized-auto-sizer'
import { FixedSizeList as List } from 'react-window'

import Player from '@components/player'
import PageLayout from '@layouts/page'

export default function () {
  const { players } = this.props

  const Row = ({ index, style }) => {
    const player = players.get(index)
    return (
      <Player style={style} player={player} key={index} />
    )
  }

  const body = (
    <AutoSizer>
      {({ height, width }) => (
        <List
          height={height}
          itemCount={players.size}
          itemSize={35}
          width={width}
        >
          {Row}
        </List>
      )}
    </AutoSizer>
  )

  return (
    <PageLayout body={body} />
  )
}
