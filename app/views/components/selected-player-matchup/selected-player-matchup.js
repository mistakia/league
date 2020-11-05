import React from 'react'

import PlayerSelectedRow from '@components/player-selected-row'
import PlayerSelectedRowHeader from '@components/player-selected-row-header'
import PlayerNameText from '@components/player-name-text'

export default class SelectedPlayerMatchup extends React.Component {
  render = () => {
    const { gamelogs, player, opp } = this.props

    if (!opp) {
      return <div>BYE</div>
    }

    const rows = []
    for (const [index, gamelog] of gamelogs.entrySeq()) {
      const lead = (
        <div className='row__group'>
          <div className='row__group-body'>
            <div className='row__text'><PlayerNameText playerId={gamelog.player} /></div>
            <div className='player__row-metric'>{gamelog.week}</div>
            <div className='player__row-metric'>{(gamelog.pts || 0).toFixed(1)}</div>
          </div>
        </div>
      )
      rows.push(
        <PlayerSelectedRow key={index} stats={gamelog} lead={lead} pos={player.pos} />
      )
    }
    return (
      <div className='selected__section'>
        <div className='selected__section-header'>
          <div className='row__group-head'>
            {player.pos} vs {opp} Gamelogs
          </div>
        </div>
        <div className='selected__section-header'>
          <div className='row__group'>
            <div className='row__group-body'>
              <div className='row__text'>Player</div>
              <div className='player__row-metric'>Wk</div>
              <div className='player__row-metric'>Pts</div>
            </div>
          </div>
          <PlayerSelectedRowHeader pos={player.pos} />
        </div>
        {rows}
      </div>
    )
  }
}
