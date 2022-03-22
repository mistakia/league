import React from 'react'
import { is } from 'immutable'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'
import CellMeasurer from 'react-virtualized/dist/es/CellMeasurer'
import CellMeasurerCache from 'react-virtualized/dist/es/CellMeasurer/CellMeasurerCache'
import AutoSizer from 'react-virtualized/dist/es/AutoSizer'
import List from 'react-virtualized/dist/es/List'

import ScoreboardPlay from '@components/scoreboard-play'

import './scoreboard-play-by-play.styl'

export default class ScoreboardPlayByPlay extends React.Component {
  constructor(props) {
    super(props)
    this._cache = new CellMeasurerCache({ defaultHeight: 85, fixedWidth: true })
    this._ref = React.createRef()
  }

  componentDidUpdate(prevProps, prevState) {
    if (!is(this.props.plays.size, prevProps.plays.size)) {
      this._resizeAll()
    }

    if (this.props.mid !== prevProps.mid && this._ref.current) {
      this._ref.current.scrollToRow(0)
    }
  }

  _resizeAll = () => {
    this._cache.clearAll()
    if (this._ref.current) {
      this._ref.current.recomputeRowHeights()
    }
  }

  render = () => {
    const { plays } = this.props

    const PlayRow = ({ index, key, parent, ...params }) => {
      const play = plays.get(index)
      return (
        <CellMeasurer
          cache={this._cache}
          columnIndex={0}
          key={key}
          parent={parent}
          rowIndex={index}
        >
          <ScoreboardPlay key={key} play={play} {...params} />
        </CellMeasurer>
      )
    }

    return (
      <div className='scoreboard__play-by-play'>
        <AutoSizer>
          {({ height, width }) => (
            <List
              width={width}
              height={height}
              ref={this._ref}
              rowHeight={this._cache.rowHeight}
              rowCount={plays.size}
              rowRenderer={PlayRow}
            />
          )}
        </AutoSizer>
      </div>
    )
  }
}

ScoreboardPlayByPlay.propTypes = {
  plays: ImmutablePropTypes.list,
  mid: PropTypes.number
}
