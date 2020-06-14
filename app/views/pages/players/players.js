import React from 'react'
import { AutoSizer, List } from 'react-virtualized'

import PositionFilter from '@components/position-filter'
import ExperienceFilter from '@components/experience-filter'
import PageLayout from '@layouts/page'
import Position from '@components/position'
import PlayerHeader from '@components/player-header'

import './players.styl'

const ROW_HEIGHT = 30

export default class PlayersPage extends React.Component {
  render () {
    const { players } = this.props

    const Row = ({ index, style, key }) => {
      const player = players.get(index).toJS()

      const passing = (
        <div className='player__row-group'>
          <div className='player__row-group-body'>
            <div className='player__row-metric'>{Math.round(player.projection.py) || 0}</div>
            <div className='player__row-metric'>{Math.round(player.projection.tdp)}</div>
            <div className='player__row-metric'>{Math.round(player.projection.ints)}</div>
          </div>
        </div>
      )

      const rushing = (
        <div className='player__row-group'>
          <div className='player__row-group-body'>
            <div className='player__row-metric'>{Math.round(player.projection.ra)}</div>
            <div className='player__row-metric'>{Math.round(player.projection.ry)}</div>
            <div className='player__row-metric'>{Math.round(player.projection.tdr)}</div>
            <div className='player__row-metric'>{Math.round(player.projection.fuml)}</div>
          </div>
        </div>
      )

      const receiving = (
        <div className='player__row-group'>
          <div className='player__row-group-body'>
            <div className='player__row-metric'>{Math.round(player.projection.trg)}</div>
            <div className='player__row-metric'>{Math.round(player.projection.rec)}</div>
            <div className='player__row-metric'>{Math.round(player.projection.recy)}</div>
            <div className='player__row-metric'>{Math.round(player.projection.tdrec)}</div>
          </div>
        </div>
      )

      return (
        <div style={style} key={key}>
          <div className='player__row'>
            <div className='player__row-pos'><Position pos={player.pos1} /></div>
            <div className='player__row-name'>{player.name}</div>
            <div className='player__row-group'>
              <div className='player__row-group-body'>
                <div className='player__row-metric'>${player.values.available}</div>
                <div className='player__row-metric'>{Math.round(player.vorp.available || 0)}</div>
                <div className='player__row-metric'>{(player.points.total || 0).toFixed(1)}</div>
              </div>
            </div>
            {passing}
            {rushing}
            {receiving}
          </div>
        </div>
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
              <PlayerHeader className='player__row-metric' label='v FA' value='values.available' />
              <PlayerHeader className='player__row-metric' label='Value' value='vorp.available' />
              <PlayerHeader className='player__row-metric' label='Proj' value='points.total' />
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
}
