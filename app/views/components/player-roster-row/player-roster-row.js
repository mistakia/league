import React from 'react'
import dayjs from 'dayjs'

import { getExtensionAmount, constants } from '@common'
import { Player, connect } from '@components/player'
import IconButton from '@components/icon-button'
import PlayerName from '@components/player-name'

import './player-roster-row.styl'

class PlayerRosterRow extends Player {
  render = () => {
    const { player, selected, isHosted, league } = this.props

    const isSelected = selected === player.player
    const classNames = ['roster__item']
    if (isSelected) classNames.push('selected')

    const deadline = dayjs.unix(league.ext_date)
    const calculateExtension = constants.season.now.isBefore(deadline)
    const { pos, tag, value, bid } = player
    const extensions = player.get('extensions', 0)
    const salary = calculateExtension
      ? getExtensionAmount({
          pos,
          tag,
          extensions,
          league,
          value,
          bid
        })
      : value

    return (
      <div className={classNames.join(' ')}>
        <div className='roster__item-name'>
          <PlayerName playerId={player.player} />
        </div>
        {Boolean(player.player) && (
          <div className='roster__item-salary metric'>{`$${salary}`}</div>
        )}
        <div className='roster__item-action'>
          {Boolean(player.player && isHosted) && (
            <IconButton
              small
              text
              icon='more'
              onClick={this.handleContextClick}
            />
          )}
        </div>
      </div>
    )
  }
}

export default connect(PlayerRosterRow)
