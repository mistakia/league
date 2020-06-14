import React from 'react'
import { AutoSizer, List } from 'react-virtualized'

import PositionFilter from '@components/position-filter'
import ExperienceFilter from '@components/experience-filter'
import PageLayout from '@layouts/page'
import Position from '@components/position'

import './players.styl'

const ROW_HEIGHT = 30

function descendingComparator (a, b, orderBy) {
  const keyPath = orderBy.split('.')
  const aValue = a.getIn(keyPath)
  const bValue = b.getIn(keyPath)
  if (bValue < aValue) {
    return -1
  }
  if (bValue > aValue) {
    return 1
  }
  return 0
}

function getComparator (order, orderBy) {
  return order === 'desc'
    ? (a, b) => descendingComparator(a, b, orderBy)
    : (a, b) => -descendingComparator(a, b, orderBy)
}

export default function () {
  const { order, orderBy } = this.state
  let { players } = this.props

  players = players.sort(getComparator(order, orderBy))

  const Row = ({ index, style, key }) => {
    const player = players.get(index).toJS()

    const passing = (
      <div className='player__row-group'>
        <div className='player__row-metric'>{Math.round(player.projection.py) || 0}</div>
        <div className='player__row-metric'>{Math.round(player.projection.tdp)}</div>
        <div className='player__row-metric'>{Math.round(player.projection.ints)}</div>
      </div>
    )
    const rushing = (
      <div className='player__row-group'>
        <div className='player__row-metric'>{Math.round(player.projection.ra)}</div>
        <div className='player__row-metric'>{Math.round(player.projection.ry)}</div>
        <div className='player__row-metric'>{Math.round(player.projection.tdr)}</div>
        <div className='player__row-metric'>{Math.round(player.projection.fuml)}</div>
      </div>
    )

    const receiving = (
      <div className='player__row-group'>
        <div className='player__row-metric'>{Math.round(player.projection.trg)}</div>
        <div className='player__row-metric'>{Math.round(player.projection.rec)}</div>
        <div className='player__row-metric'>{Math.round(player.projection.recy)}</div>
        <div className='player__row-metric'>{Math.round(player.projection.tdrec)}</div>
      </div>
    )

    return (
      <div style={style} key={key}>
        <div className='player__row'>
          <div className='player__row-pos'><Position pos={player.pos1} /></div>
          <div className='player__row-name'>{player.name}</div>
          <div className='player__row-metric'>${player.values.available}</div>
          <div className='player__row-metric'>{Math.round(player.vorp.available || 0)}</div>
          <div className='player__row-metric'>{(player.points.total || 0).toFixed(1)}</div>
          {passing}
          {rushing}
          {receiving}
        </div>
      </div>
    )
  }

  const hPassing = (
    <div className='player__row-group'>
      <div className='player__row-metric'>YDS</div>
      <div className='player__row-metric'>TD</div>
      <div className='player__row-metric'>INT</div>
    </div>
  )

  const hRushing = (
    <div className='player__row-group'>
      <div className='player__row-metric'>CAR</div>
      <div className='player__row-metric'>YDS</div>
      <div className='player__row-metric'>TD</div>
      <div className='player__row-metric'>FUM</div>
    </div>
  )

  const hReceiving = (
    <div className='player__row-group'>
      <div className='player__row-metric'>TAR</div>
      <div className='player__row-metric'>REC</div>
      <div className='player__row-metric'>YDS</div>
      <div className='player__row-metric'>TD</div>
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
        <div className='player__row-metric'>v FA</div>
        <div className='player__row-metric'>Value</div>
        <div className='player__row-metric'>Proj</div>
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
          className='players'
          width={width}
          height={height}
          rowHeight={ROW_HEIGHT}
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
