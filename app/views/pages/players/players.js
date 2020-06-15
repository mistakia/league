import React from 'react'
import { AutoSizer, List } from 'react-virtualized'

import PositionFilter from '@components/position-filter'
import ExperienceFilter from '@components/experience-filter'
import PageLayout from '@layouts/page'
import PlayerHeader from '@components/player-header'
import PlayerRow from '@components/player-row'

import './players.styl'

const ROW_HEIGHT = 30
const EXPANDED_ROW_HEIGHT = 250

export default class PlayersPage extends React.Component {
  list = React.createRef()

  rowHeight = ({ index }) => {
    const player = this.props.players.get(index)
    const isSelected = player ? player.player === this.props.selected : false
    return isSelected ? EXPANDED_ROW_HEIGHT : ROW_HEIGHT
  }

  componentDidUpdate = (prevProps) => {
    if (prevProps.order !== this.props.order || prevProps.orderBy !== this.props.orderBy) {
      this.list.current.scrollToPosition(0)
    }

    if (!this.props.selected) {
      setImmediate(() => {
        this.list.current.recomputeRowHeights(0)
      }, 100)
    } else if (prevProps.selected !== this.props.selected) {
      const index = this.props.players.findIndex(p => p.player === this.props.selected)
      this.list.current.recomputeRowHeights(index)
      if (prevProps.selected) {
        const index = this.props.players.findIndex(p => p.player === prevProps.selected)
        this.list.current.recomputeRowHeights(index)
      }
    } else {
      this.list.current.recomputeRowHeights()
    }
  }

  render = () => {
    const { players } = this.props

    const Row = ({ index, ...params }) => {
      const player = players.get(index).toJS()
      return <PlayerRow player={player} {...params} />
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
          <PlayerHeader className='player__row-metric' label='TD'  value='projection.tdr' />
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
          <PlayerHeader className='player__row-metric' label='TD'  value='projection.tdrec' />
        </div>
      </div>
    )

    const head = (
      <div className='players__head'>
        <div className='players__filter'>
          <PositionFilter />
          <ExperienceFilter />
        </div>
        <div className='players__header'>
          <div className='player__row-pos'></div>
          <div className='player__row-name'>Name</div>
          <div className='player__row-group'>
            <div className='player__row-group-body'>
              <PlayerHeader
                className='player__row-metric'
                label='v FA'
                value='values.available' />
              <PlayerHeader
                className='player__row-metric'
                label='Value'
                value='vorp.available' />
              <PlayerHeader
                className='player__row-metric'
                label='Proj'
                value='points.total' />
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
            rowHeight={this.rowHeight}
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
