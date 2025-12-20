import React, { useEffect, useMemo, useRef } from 'react'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'
import CellMeasurer from 'react-virtualized-compat/dist/es/CellMeasurer'
import CellMeasurerCache from 'react-virtualized-compat/dist/es/CellMeasurer/CellMeasurerCache'
import AutoSizer from 'react-virtualized-compat/dist/es/AutoSizer'
import List from 'react-virtualized-compat/dist/es/List'

import ScoreboardPlay from '@components/scoreboard-play'

import './scoreboard-play-by-play.styl'

export default function ScoreboardPlayByPlay({ plays, mid }) {
  const cell_cache = useMemo(
    () =>
      new CellMeasurerCache({
        defaultHeight: 85,
        fixedWidth: true
      }),
    []
  )
  const ref = useRef()

  useEffect(() => {
    cell_cache.clearAll()
    if (ref.current) {
      ref.current.recomputeRowHeights()
    }
  }, [plays.size, cell_cache])

  useEffect(() => {
    if (ref.current) {
      ref.current.scrollToRow(0)
    }
  }, [mid])

  const PlayRow = ({ index, key, parent, style }) => {
    const play = plays.get(index)
    if (!play) {
      return null
    }

    return (
      <CellMeasurer
        cache={cell_cache}
        columnIndex={0}
        key={key}
        parent={parent}
        rowIndex={index}
      >
        <div style={style}>
          <ScoreboardPlay play={play} />
        </div>
      </CellMeasurer>
    )
  }

  PlayRow.propTypes = {
    index: PropTypes.number,
    key: PropTypes.string,
    parent: PropTypes.object,
    style: PropTypes.object
  }

  if (!plays || plays.size === 0) {
    return (
      <div className='scoreboard__play-by-play'>
        <div style={{ padding: '20px', textAlign: 'center', color: '#999' }}>
          No plays available
        </div>
      </div>
    )
  }

  const row_height = (index) => cell_cache.rowHeight(index)

  return (
    <div className='scoreboard__play-by-play'>
      <AutoSizer>
        {({ height, width }) => (
          <List
            width={width}
            height={height}
            ref={ref}
            rowHeight={row_height}
            deferredMeasurementCache={cell_cache}
            rowCount={plays.size}
            rowRenderer={PlayRow}
            overscanRowCount={5}
          />
        )}
      </AutoSizer>
    </div>
  )
}

ScoreboardPlayByPlay.propTypes = {
  plays: ImmutablePropTypes.list,
  mid: PropTypes.number
}
