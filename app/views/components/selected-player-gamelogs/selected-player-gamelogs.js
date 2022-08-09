import React from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'
import PropTypes from 'prop-types'

import PlayerSelectedRow from '@components/player-selected-row'
import PlayerSelectedRowHeader from '@components/player-selected-row-header'

import './selected-player-gamelogs.styl'

export default class SelectedPlayerGamelogs extends React.Component {
  componentDidMount = () => {
    const pid = this.props.playerMap.get('pid')
    this.props.load(pid)
  }

  render = () => {
    const { years, playerMap } = this.props

    const position = playerMap.get('pos')
    const rows = []
    const sorted_years = Object.keys(years).sort((a, b) => b - a)
    sorted_years.forEach((year, index) => {
      rows.push(
        <div className='header__row sticky__column sticky__row'>{year}</div>
      )
      const gamelogs = years[year]
      gamelogs.forEach((game, index) => {
        const lead = (
          <>
            <div className='table__cell metric sticky__column game__day'>
              {game.day}
            </div>
            <div className='table__cell metric sticky__column sticky__two game__week'>
              {game.week}
            </div>
            <div className='table__cell metric date'>{game.date}</div>
            <div className='table__cell metric'>{game.opp}</div>
            <div className='table__cell metric'>
              {(game.total || 0).toFixed(1)}
            </div>
          </>
        )
        rows.push(
          <PlayerSelectedRow
            key={index}
            stats={game}
            lead={lead}
            pos={position}
          />
        )
      })
    })

    return (
      <div className='selected__table'>
        <div className='selected__section-header sticky__column'>
          <div className='row__group-head'>Gamelogs</div>
        </div>
        <div className='selected__table-header sticky'>
          <div className='table__cell metric sticky__column game__day'>Day</div>
          <div className='table__cell metric sticky__column sticky__two game__week'>
            Wk
          </div>
          <div className='table__cell metric date'>Date</div>
          <div className='table__cell metric'>Opp</div>
          <div className='table__cell metric'>Pts</div>
          <PlayerSelectedRowHeader pos={position} />
        </div>
        {rows}
      </div>
    )
  }
}

SelectedPlayerGamelogs.propTypes = {
  years: PropTypes.object,
  playerMap: ImmutablePropTypes.map,
  load: PropTypes.func
}
