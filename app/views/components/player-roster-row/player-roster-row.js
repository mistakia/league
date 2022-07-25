import React from 'react'
import dayjs from 'dayjs'

import { getExtensionAmount, constants } from '@common'
import { Player, connect } from '@components/player'
import IconButton from '@components/icon-button'
import PlayerName from '@components/player-name'

import './player-roster-row.styl'

class PlayerRosterRow extends Player {
  render = () => {
    const {
      playerMap,
      selected,
      isHosted,
      league,
      showBid,
      practice,
      reserve
    } = this.props

    const pid = playerMap.get('pid')
    const isSelected = pid && selected === pid
    const classNames = ['roster__item']
    if (isSelected) classNames.push('selected')
    if (practice) classNames.push('practice')
    if (reserve) classNames.push('reserve')

    const deadline = dayjs.unix(league.ext_date)
    const calculateExtension = constants.season.now.isBefore(deadline)
    const extensions = playerMap.get('extensions', 0)
    const value = playerMap.get('value')
    const bid = playerMap.get('bid')
    const salary = calculateExtension
      ? getExtensionAmount({
          pos: playerMap.get('pos'),
          tag: playerMap.get('tag'),
          extensions,
          league,
          value
        })
      : (showBid && bid) || value

    return (
      <div className={classNames.join(' ')}>
        <div className='roster__item-name'>
          <PlayerName pid={pid} />
        </div>
        {Boolean(pid) && (
          <div className='roster__item-salary metric'>{`$${salary}`}</div>
        )}
        <div className='roster__item-action'>
          {Boolean(pid && isHosted) && (
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
