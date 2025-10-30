import React from 'react'
import dayjs from 'dayjs'

import { getExtensionAmount, constants } from '@libs-shared'
import { Player, connect } from '@components/player'
import IconButton from '@components/icon-button'
import PlayerName from '@components/player-name'

import './player-roster-row.styl'

class PlayerRosterRow extends Player {
  render = () => {
    const {
      player_map,
      selected,
      is_hosted,
      league,
      show_bid,
      practice_signed,
      practice_drafted,
      reserve,
      starter
    } = this.props

    const pid = player_map.get('pid')
    const is_selected = pid && selected === pid
    const class_names = ['roster__item']
    if (is_selected) class_names.push('selected')
    if (practice_signed) class_names.push('practice__signed')
    if (practice_drafted) class_names.push('practice__drafted')
    if (reserve) class_names.push('reserve')
    if (starter) class_names.push('starter')

    const deadline = dayjs.unix(league.ext_date)
    const calculate_extension =
      !practice_signed &&
      !practice_drafted &&
      constants.season.now.isBefore(deadline)
    const extensions = player_map.get('extensions', 0)
    const value = player_map.get('value')
    const bid = player_map.get('bid')
    const salary = calculate_extension
      ? getExtensionAmount({
          pos: player_map.get('pos'),
          tag: player_map.get('tag'),
          extensions,
          league,
          value
        })
      : (show_bid && bid) || value

    return (
      <div className={class_names.join(' ')}>
        {Boolean(pid) && (
          <div className='roster__item-name'>
            <PlayerName pid={pid} show_reserve_tag />
          </div>
        )}
        {Boolean(pid) && (
          <div className='roster__item-salary metric'>{`$${salary}`}</div>
        )}
        <div className='roster__item-action'>
          {Boolean(pid && is_hosted) && (
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
