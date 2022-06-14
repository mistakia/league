import React from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'
import PropTypes from 'prop-types'

import PlayerSelectedRow from '@components/player-selected-row'
import PlayerSelectedRowHeader from '@components/player-selected-row-header'

export default class SelectedPlayerGamelogs extends React.Component {
  render = () => {
    const { gamelogs, playerMap } = this.props

    const position = playerMap.get('pos')
    const rows = []
    for (const [index, game] of gamelogs.entries()) {
      const lead = (
        <div className='row__group'>
          <div className='row__group-body'>
            <div className='table__cell metric'>{game.week}</div>
            <div className='table__cell metric'>{game.opp}</div>
            <div className='table__cell metric'>
              {playerMap
                .getIn(['points', `${game.week}`, 'total'], 0)
                .toFixed(1)}
            </div>
            <div className='table__cell metric'>
              {(game.total || 0).toFixed(1)}
            </div>
          </div>
        </div>
      )
      rows.push(
        <PlayerSelectedRow
          key={index}
          stats={game}
          lead={lead}
          pos={position}
        />
      )
    }

    return (
      <div className='selected__section'>
        <div className='selected__section-header'>
          <div className='row__group-head'>Gamelogs</div>
        </div>
        <div className='selected__section-header'>
          <div className='row__group'>
            <div className='row__group-body'>
              <div className='table__cell metric'>Wk</div>
              <div className='table__cell metric'>Opp</div>
              <div className='table__cell metric'>Prj</div>
              <div className='table__cell metric'>Pts</div>
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
  gamelogs: PropTypes.array,
  playerMap: ImmutablePropTypes.map
}
