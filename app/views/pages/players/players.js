import React from 'react'
import { CellMeasurerCache, CellMeasurer, AutoSizer, List } from 'react-virtualized'

import SearchFilter from '@components/search-filter'
import PositionFilter from '@components/position-filter'
import ExperienceFilter from '@components/experience-filter'
import AgeFilter from '@components/age-filter'
import PageLayout from '@layouts/page'
import PlayerHeader from '@components/player-header'
import PlayerRow from '@components/player-row'

import './players.styl'

const ROW_HEIGHT = 30

const cache = new CellMeasurerCache({
  fixedWidth: true,
  minHeight: 25,
  defaultHeight: ROW_HEIGHT
})

export default class PlayersPage extends React.Component {
  list = React.createRef()

  componentDidUpdate = (prevProps) => {
    if (prevProps.order !== this.props.order || prevProps.orderBy !== this.props.orderBy) {
      this.list.current.scrollToPosition(0)
    }

    if (this.props.selected) {
      const index = this.props.players.findIndex(p => p.player === this.props.selected)
      this.list.current.scrollToRow(index)
    }

    cache.clear()
    this.list.current.recomputeRowHeights()
  }

  render = () => {
    const { players, vbaseline } = this.props

    const Row = ({ index, key, parent, ...params }) => {
      const player = players.get(index).toJS()
      return (
        <CellMeasurer
          cache={cache}
          columnIndex={0}
          key={key}
          parent={parent}
          rowIndex={index}
        >
          <PlayerRow player={player} {...params} />
        </CellMeasurer>
      )
    }

    const hPassing = (
      <div className='player__row-group'>
        <div className='player__row-group-head'>Passing</div>
        <div className='player__row-group-body'>
          <PlayerHeader className='player__row-metric' label='YDS' value='projection.py' />
          <PlayerHeader className='player__row-metric' label='TD' value='projection.tdp' />
          <PlayerHeader className='player__row-metric' label='INT' value='projection.ints' />
        </div>
      </div>
    )

    const hRushing = (
      <div className='player__row-group'>
        <div className='player__row-group-head'>Rushing</div>
        <div className='player__row-group-body'>
          <PlayerHeader className='player__row-metric' label='CAR' value='projection.ra' />
          <PlayerHeader className='player__row-metric' label='YDS' value='projection.ry' />
          <PlayerHeader className='player__row-metric' label='TD' value='projection.tdr' />
          <PlayerHeader className='player__row-metric' label='FUM' value='projection.fuml' />
        </div>
      </div>
    )

    const hReceiving = (
      <div className='player__row-group'>
        <div className='player__row-group-head'>Receiving</div>
        <div className='player__row-group-body'>
          <PlayerHeader className='player__row-metric' label='TAR' value='projection.trg' />
          <PlayerHeader className='player__row-metric' label='REC' value='projection.rec' />
          <PlayerHeader className='player__row-metric' label='YDS' value='projection.recy' />
          <PlayerHeader className='player__row-metric' label='TD' value='projection.tdrec' />
        </div>
      </div>
    )

    const valueType = `values.${vbaseline}`
    const vorpType = `vorp.${vbaseline}`

    const head = (
      <div className='players__head'>
        <div className='players__filter'>
          <SearchFilter search={this.props.search} value={this.props.searchValue} />
          <PositionFilter />
          <ExperienceFilter />
          <AgeFilter />
        </div>
        <div className='players__header'>
          <div className='player__row-action' />
          <div className='player__row-pos' />
          <div className='player__row-name'>Name</div>
          <div className='player__row-group'>
            <div className='player__row-group-body'>
              <PlayerHeader
                className='player__row-metric'
                label='Cost'
                value={valueType}
              />
              <PlayerHeader
                className='player__row-metric'
                label='Value'
                value={vorpType}
              />
              <PlayerHeader
                className='player__row-metric'
                label='Proj'
                value='points.total'
              />
            </div>
          </div>
          {hPassing}
          {hRushing}
          {hReceiving}
        </div>
      </div>
    )

    const body = (
      <AutoSizer>
        {({ height, width }) => (
          <List
            ref={this.list}
            className='players'
            width={width}
            height={height}
            rowHeight={cache.rowHeight}
            rowCount={players.size}
            rowRenderer={Row}
          />
        )}
      </AutoSizer>
    )

    return (
      <PageLayout {...{ body, head }} />
    )
  }
}
