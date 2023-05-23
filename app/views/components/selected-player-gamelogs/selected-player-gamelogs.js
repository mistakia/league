import React from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'
import PropTypes from 'prop-types'

import PlayerSelectedRow from '@components/player-selected-row'
import PlayerSelectedRowHeader from '@components/player-selected-row-header'

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
    sorted_years.forEach((year, yearIndex) => {
      rows.push(
        <div key={yearIndex} className='header__row sticky__column sticky__row'>
          {year}
        </div>
      )
      const gamelogs = years[year]
      gamelogs.forEach((game, gameIndex) => {
        const lead = (
          <>
            <div className='table__cell metric sticky__column game__day'>
              {game.day}
            </div>
            <div className='table__cell metric sticky__column sticky__two game__week'>
              {game.week}
            </div>
            <div className='table__cell metric'>{game.opp}</div>
            <div className='table__cell metric'>
              {(game.points || 0).toFixed(1)}
            </div>
            <div className='table__cell metric'>
              {game.points_added ? game.points_added.toFixed(1) : '-'}
            </div>
            <div className='table__cell metric'>{game.pos_rnk || '-'}</div>
          </>
        )

        rows.push(
          <PlayerSelectedRow
            key={`${yearIndex}/${gameIndex}`}
            className={game.seas_type}
            stats={game}
            lead={lead}
            pos={position}
          />
        )
      })
    })

    return (
      <div className='selected__table'>
        <div className='selected__table-header sticky__column'>
          <div className='row__group-head'>Gamelogs</div>
        </div>
        <div className='selected__table-header sticky'>
          <div className='table__cell metric sticky__column game__day' />
          <div className='table__cell metric sticky__column sticky__two game__week'>
            Wk
          </div>
          <div className='table__cell'>Opp</div>
          <div className='row__group'>
            <div className='row__group-head'>Fantasy</div>
            <div className='row__group-body'>
              <div className='table__cell'>Pts</div>
              <div className='table__cell'>Pts+</div>
              <div className='table__cell'>Rnk</div>
            </div>
          </div>
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
