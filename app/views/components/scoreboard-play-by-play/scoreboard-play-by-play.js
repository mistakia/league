import React, { useEffect, useMemo } from 'react'
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
  const ref = React.createRef()

  useEffect(() => {
    cell_cache.clearAll()
    if (ref.current) {
      ref.current.recomputeRowHeights()
    }
  }, [plays.size, cell_cache, ref])

  useEffect(() => {
    if (ref.current) {
      ref.current.scrollToRow(0)
    }
  }, [mid, ref])

  const PlayRow = ({ index, key, parent, style }) => {
    const play = plays.get(index)
    return (
      <CellMeasurer
        cache={cell_cache}
        columnIndex={0}
        key={key}
        parent={parent}
        rowIndex={index}
      >
        <ScoreboardPlay play={play} style={style} />
      </CellMeasurer>
    )
  }

  PlayRow.propTypes = {
    index: PropTypes.number,
    key: PropTypes.string,
    parent: PropTypes.object,
    style: PropTypes.object
  }

  return (
    <div className='scoreboard__play-by-play'>
      <AutoSizer>
        {({ height, width }) => (
          <List
            width={width}
            height={height}
            ref={ref}
            rowHeight={cell_cache.rowHeight}
            rowCount={plays.size}
            rowRenderer={PlayRow}
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
