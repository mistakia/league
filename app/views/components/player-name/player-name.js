import React from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'
import PropTypes from 'prop-types'

import Position from '@components/position'
import Team from '@components/team'
import { constants } from '@common'
import PlayerLabel from '@components/player-label'

import './player-name.styl'

export default class PlayerName extends React.Component {
  handleClick = () => {
    this.props.select(this.props.player.player)
  }

  render = () => {
    const { player } = this.props

    return (
      <div className='player__name cursor' onClick={this.handleClick}>
        <div className='player__name-position'>
          <Position pos={player.pos} />
        </div>
        <div className='player__name-main'>
          <span>{player.pname}</span>
          {constants.season.year === player.draft_year && (
            <PlayerLabel label='R' type='rookie' description='Rookie' />
          )}
          <Team team={player.team} />
          {player.slot === constants.slots.PSP && (
            <PlayerLabel label='P' description='Protected Practice Squad' />
          )}
        </div>
      </div>
    )
  }
}

PlayerName.propTypes = {
  player: ImmutablePropTypes.record,
  select: PropTypes.func
}
