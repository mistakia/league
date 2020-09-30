import React from 'react'

import PlayerSelectedRow from '@components/player-selected-row'
import PlayerSelectedRowHeader from '@components/player-selected-row-header'

export default class SelectedPlayerGamelogs extends React.Component {
  render = () => {
    const { gamelogs, player } = this.props

    const rows = []
    for (const [index, game] of gamelogs.entries()) {
      const lead = (
        <div className='row__group'>
          <div className='row__group-body'>
            <div className='player__row-metric'>{game.week}</div>
            <div className='player__row-metric'>{game.opp}</div>
            <div className='player__row-metric'>
              {player.getIn(['points', `${game.week}`, 'total'], 0).toFixed(1)}
            </div>
            <div className='player__row-metric'>{(game.total || 0).toFixed(1)}</div>
          </div>
        </div>
      )
      rows.push(
        <PlayerSelectedRow key={index} stats={game} lead={lead} pos={player.pos1} />
      )
    }

    return (
      <div>
        <div className='selected__section'>
          <div className='selected__section-header'>
            <div className='row__group-head'>
              Gamelogs
            </div>
          </div>
          <div className='selected__section-header'>
            <div className='row__group'>
              <div className='row__group-body'>
                <div className='player__row-metric'>Wk</div>
                <div className='player__row-metric'>Opp</div>
                <div className='player__row-metric'>Prj</div>
                <div className='player__row-metric'>Pts</div>
              </div>
            </div>
            <PlayerSelectedRowHeader pos={player.pos1} />
          </div>
          {rows}
        </div>
      </div>
    )
  }
}
